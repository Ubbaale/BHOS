import { Router, type IRouter } from "express";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { db, timePunchesTable, staffTable, homesTable, fraudAlertsTable } from "@workspace/db";
import {
  CreateTimePunchBody,
  ListTimePunchesQueryParams,
  GetActiveTimePunchQueryParams,
  ListTimePunchesResponse,
  GetActiveTimePunchResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const punchSelect = {
  id: timePunchesTable.id,
  staffId: timePunchesTable.staffId,
  staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
  homeId: timePunchesTable.homeId,
  homeName: homesTable.name,
  type: timePunchesTable.type,
  punchTime: timePunchesTable.punchTime,
  latitude: sql<number | null>`${timePunchesTable.latitude}::float`,
  longitude: sql<number | null>`${timePunchesTable.longitude}::float`,
  isWithinGeofence: timePunchesTable.isWithinGeofence,
  distanceFromHome: sql<number | null>`${timePunchesTable.distanceFromHome}::float`,
  notes: timePunchesTable.notes,
  createdAt: timePunchesTable.createdAt,
};

const alertSelect = {
  id: fraudAlertsTable.id,
  staffId: fraudAlertsTable.staffId,
  staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
  homeId: fraudAlertsTable.homeId,
  homeName: homesTable.name,
  timePunchId: fraudAlertsTable.timePunchId,
  alertType: fraudAlertsTable.alertType,
  severity: fraudAlertsTable.severity,
  description: fraudAlertsTable.description,
  status: fraudAlertsTable.status,
  reviewedBy: fraudAlertsTable.reviewedBy,
  reviewedAt: fraudAlertsTable.reviewedAt,
  createdAt: fraudAlertsTable.createdAt,
};

router.get("/time-punches", async (req, res): Promise<void> => {
  const queryParams = ListTimePunchesQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  let query = db
    .select(punchSelect)
    .from(timePunchesTable)
    .leftJoin(staffTable, eq(timePunchesTable.staffId, staffTable.id))
    .leftJoin(homesTable, eq(timePunchesTable.homeId, homesTable.id))
    .orderBy(desc(timePunchesTable.punchTime))
    .$dynamic();

  if (queryParams.data.staffId) {
    query = query.where(eq(timePunchesTable.staffId, queryParams.data.staffId));
  }
  if (queryParams.data.homeId) {
    query = query.where(eq(timePunchesTable.homeId, queryParams.data.homeId));
  }

  const punches = await query;
  res.json(ListTimePunchesResponse.parse(punches));
});

router.get("/time-punches/active", async (req, res): Promise<void> => {
  const queryParams = GetActiveTimePunchQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [activePunch] = await db
    .select(punchSelect)
    .from(timePunchesTable)
    .leftJoin(staffTable, eq(timePunchesTable.staffId, staffTable.id))
    .leftJoin(homesTable, eq(timePunchesTable.homeId, homesTable.id))
    .where(
      and(
        eq(timePunchesTable.staffId, queryParams.data.staffId),
        eq(timePunchesTable.type, "clock_in"),
        gte(timePunchesTable.punchTime, twentyFourHoursAgo)
      )
    )
    .orderBy(desc(timePunchesTable.punchTime))
    .limit(1);

  if (activePunch) {
    const [matchingClockOut] = await db
      .select({ id: timePunchesTable.id })
      .from(timePunchesTable)
      .where(
        and(
          eq(timePunchesTable.staffId, queryParams.data.staffId),
          eq(timePunchesTable.type, "clock_out"),
          gte(timePunchesTable.punchTime, activePunch.punchTime)
        )
      )
      .limit(1);

    if (matchingClockOut) {
      res.json(GetActiveTimePunchResponse.parse({ activePunch: null }));
      return;
    }
  }

  res.json(GetActiveTimePunchResponse.parse({ activePunch: activePunch || null }));
});

router.post("/time-punches", async (req, res): Promise<void> => {
  const parsed = CreateTimePunchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { staffId, homeId, type, latitude, longitude, notes } = parsed.data;
  const alerts: any[] = [];

  const [staff] = await db.select({ id: staffTable.id }).from(staffTable).where(eq(staffTable.id, staffId));
  if (!staff) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }

  const [home] = await db.select().from(homesTable).where(eq(homesTable.id, homeId));
  if (!home) {
    res.status(404).json({ error: "Home not found" });
    return;
  }

  if (type === "clock_out") {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [activeClockIn] = await db
      .select({ id: timePunchesTable.id })
      .from(timePunchesTable)
      .where(
        and(
          eq(timePunchesTable.staffId, staffId),
          eq(timePunchesTable.type, "clock_in"),
          gte(timePunchesTable.punchTime, twentyFourHoursAgo),
          sql`NOT EXISTS (
            SELECT 1 FROM time_punches tp2
            WHERE tp2.staff_id = ${staffId}
            AND tp2.type = 'clock_out'
            AND tp2.punch_time > ${timePunchesTable.punchTime}
          )`
        )
      )
      .orderBy(desc(timePunchesTable.punchTime))
      .limit(1);

    if (!activeClockIn) {
      res.status(400).json({ error: "No active clock-in found. Clock in first." });
      return;
    }
  }

  let isWithinGeofence: boolean | null = null;
  let distanceFromHome: number | null = null;

  if (latitude != null && longitude != null && home.latitude && home.longitude) {
    distanceFromHome = Math.round(
      haversineDistance(
        Number(home.latitude), Number(home.longitude),
        latitude, longitude
      )
    );
    isWithinGeofence = distanceFromHome <= home.geofenceRadiusMeters;

    if (!isWithinGeofence && type === "clock_in") {
      const [alert] = await db
        .insert(fraudAlertsTable)
        .values({
          staffId,
          homeId,
          alertType: "off_site_clock_in",
          severity: distanceFromHome > 1000 ? "high" : "medium",
          description: `Staff clocked in ${distanceFromHome}m from ${home.name} (geofence: ${home.geofenceRadiusMeters}m)`,
          status: "open",
        })
        .returning();
      alerts.push(alert);
    }
  }

  if (type === "clock_in") {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [recentPunch] = await db
      .select()
      .from(timePunchesTable)
      .where(
        and(
          eq(timePunchesTable.staffId, staffId),
          gte(timePunchesTable.punchTime, fiveMinAgo)
        )
      )
      .orderBy(desc(timePunchesTable.punchTime))
      .limit(1);

    if (recentPunch) {
      const [alert] = await db
        .insert(fraudAlertsTable)
        .values({
          staffId,
          homeId,
          alertType: "rapid_punch",
          severity: "medium",
          description: `Staff punched twice within 5 minutes at ${home.name}`,
          status: "open",
        })
        .returning();
      alerts.push(alert);
    }

    const now = new Date();
    const [overlapping] = await db
      .select()
      .from(timePunchesTable)
      .where(
        and(
          eq(timePunchesTable.staffId, staffId),
          eq(timePunchesTable.type, "clock_in"),
          sql`NOT EXISTS (
            SELECT 1 FROM time_punches tp2 
            WHERE tp2.staff_id = ${staffId} 
            AND tp2.type = 'clock_out' 
            AND tp2.punch_time > ${timePunchesTable.punchTime}
            AND tp2.punch_time <= ${now}
          )`,
          sql`${timePunchesTable.punchTime} < ${now}`
        )
      )
      .limit(1);

    if (overlapping) {
      const [alert] = await db
        .insert(fraudAlertsTable)
        .values({
          staffId,
          homeId,
          alertType: "overlapping_shift",
          severity: "high",
          description: `Staff clocked in at ${home.name} while already clocked in (punch #${overlapping.id})`,
          status: "open",
        })
        .returning();
      alerts.push(alert);
    }
  }

  const [punch] = await db
    .insert(timePunchesTable)
    .values({
      staffId,
      homeId,
      type,
      latitude: latitude?.toString() ?? null,
      longitude: longitude?.toString() ?? null,
      isWithinGeofence,
      distanceFromHome: distanceFromHome?.toString() ?? null,
      notes: notes ?? null,
    })
    .returning();

  if (alerts.length > 0) {
    await db
      .update(fraudAlertsTable)
      .set({ timePunchId: punch.id })
      .where(sql`${fraudAlertsTable.id} IN (${sql.join(alerts.map(a => sql`${a.id}`), sql`, `)})`);
  }

  const [result] = await db
    .select(punchSelect)
    .from(timePunchesTable)
    .leftJoin(staffTable, eq(timePunchesTable.staffId, staffTable.id))
    .leftJoin(homesTable, eq(timePunchesTable.homeId, homesTable.id))
    .where(eq(timePunchesTable.id, punch.id));

  const alertResults = alerts.length > 0 ? await db
    .select(alertSelect)
    .from(fraudAlertsTable)
    .leftJoin(staffTable, eq(fraudAlertsTable.staffId, staffTable.id))
    .leftJoin(homesTable, eq(fraudAlertsTable.homeId, homesTable.id))
    .where(sql`${fraudAlertsTable.id} IN (${sql.join(alerts.map(a => sql`${a.id}`), sql`, `)})`)
    : [];

  res.status(201).json({ timePunch: result, alerts: alertResults });
});

export default router;
