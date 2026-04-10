import { Router, type IRouter } from "express";
import { db, homesTable, patientsTable, staffTable, incidentsTable, shiftsTable, medicationAdministrationsTable, medicationsTable, dailyLogsTable } from "@workspace/db";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetMedicationComplianceResponse,
  GetIncidentTrendsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [homeCount] = await db.select({ count: sql<number>`count(*)::int` }).from(homesTable);
  const [patientCount] = await db.select({ count: sql<number>`count(*)::int` }).from(patientsTable).where(eq(patientsTable.status, "active"));
  const [staffCount] = await db.select({ count: sql<number>`count(*)::int` }).from(staffTable).where(eq(staffTable.status, "active"));

  const [activeIncidentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(incidentsTable)
    .where(sql`${incidentsTable.status} IN ('open', 'investigating')`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayShiftCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shiftsTable)
    .where(and(gte(shiftsTable.startTime, today), lte(shiftsTable.startTime, tomorrow)));

  const [activeMedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(medicationsTable)
    .where(eq(medicationsTable.active, true));

  const [totalAdmin] = await db.select({ count: sql<number>`count(*)::int` }).from(medicationAdministrationsTable);
  const [givenAdmin] = await db.select({ count: sql<number>`count(*)::int` }).from(medicationAdministrationsTable).where(eq(medicationAdministrationsTable.status, "given"));

  const complianceRate = totalAdmin.count > 0 ? Math.round((givenAdmin.count / totalAdmin.count) * 100) : 100;

  const severityCounts = await db
    .select({
      severity: incidentsTable.severity,
      count: sql<number>`count(*)::int`,
    })
    .from(incidentsTable)
    .where(sql`${incidentsTable.status} IN ('open', 'investigating')`)
    .groupBy(incidentsTable.severity);

  const incidentsByseverity = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const s of severityCounts) {
    if (s.severity in incidentsByseverity) {
      incidentsByseverity[s.severity as keyof typeof incidentsByseverity] = s.count;
    }
  }

  const summary = {
    totalHomes: homeCount.count,
    totalPatients: patientCount.count,
    totalStaff: staffCount.count,
    activeIncidents: activeIncidentCount.count,
    todayShifts: todayShiftCount.count,
    medicationsDueToday: activeMedCount.count,
    complianceRate,
    incidentsByseverity,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  const recentIncidents = await db
    .select({
      id: incidentsTable.id,
      title: incidentsTable.title,
      description: incidentsTable.description,
      homeName: homesTable.name,
      timestamp: incidentsTable.createdAt,
    })
    .from(incidentsTable)
    .leftJoin(homesTable, eq(incidentsTable.homeId, homesTable.id))
    .orderBy(sql`${incidentsTable.createdAt} DESC`)
    .limit(5);

  const recentLogs = await db
    .select({
      id: dailyLogsTable.id,
      patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
      mood: dailyLogsTable.mood,
      homeName: sql<string>`''`,
      timestamp: dailyLogsTable.createdAt,
    })
    .from(dailyLogsTable)
    .leftJoin(patientsTable, eq(dailyLogsTable.patientId, patientsTable.id))
    .orderBy(sql`${dailyLogsTable.createdAt} DESC`)
    .limit(5);

  const activities = [
    ...recentIncidents.map((i, idx) => ({
      id: i.id + 10000,
      type: "incident" as const,
      title: `Incident: ${i.title}`,
      description: i.description.substring(0, 100),
      homeName: i.homeName,
      timestamp: i.timestamp,
    })),
    ...recentLogs.map((l) => ({
      id: l.id + 20000,
      type: "daily_log" as const,
      title: `Daily Log: ${l.patientName}`,
      description: `Mood: ${l.mood}`,
      homeName: l.homeName || null,
      timestamp: l.timestamp,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
    .slice(0, 10);

  res.json(GetRecentActivityResponse.parse(activities));
});

router.get("/dashboard/medication-compliance", async (_req, res): Promise<void> => {
  const homes = await db.select().from(homesTable).orderBy(homesTable.name);

  const compliance = [];
  for (const home of homes) {
    const patients = await db.select({ id: patientsTable.id }).from(patientsTable).where(eq(patientsTable.homeId, home.id));
    const patientIds = patients.map((p) => p.id);

    if (patientIds.length === 0) {
      compliance.push({
        homeId: home.id,
        homeName: home.name,
        totalDoses: 0,
        givenDoses: 0,
        missedDoses: 0,
        complianceRate: 100,
      });
      continue;
    }

    const [total] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(medicationAdministrationsTable)
      .where(sql`${medicationAdministrationsTable.patientId} IN (${sql.join(patientIds.map(id => sql`${id}`), sql`, `)})`);

    const [given] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(medicationAdministrationsTable)
      .where(sql`${medicationAdministrationsTable.patientId} IN (${sql.join(patientIds.map(id => sql`${id}`), sql`, `)}) AND ${medicationAdministrationsTable.status} = 'given'`);

    const [missed] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(medicationAdministrationsTable)
      .where(sql`${medicationAdministrationsTable.patientId} IN (${sql.join(patientIds.map(id => sql`${id}`), sql`, `)}) AND ${medicationAdministrationsTable.status} = 'missed'`);

    compliance.push({
      homeId: home.id,
      homeName: home.name,
      totalDoses: total.count,
      givenDoses: given.count,
      missedDoses: missed.count,
      complianceRate: total.count > 0 ? Math.round((given.count / total.count) * 100) : 100,
    });
  }

  res.json(GetMedicationComplianceResponse.parse(compliance));
});

router.get("/dashboard/incident-trends", async (_req, res): Promise<void> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trends = await db
    .select({
      date: sql<string>`TO_CHAR(${incidentsTable.occurredAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
      low: sql<number>`count(*) FILTER (WHERE ${incidentsTable.severity} = 'low')::int`,
      medium: sql<number>`count(*) FILTER (WHERE ${incidentsTable.severity} = 'medium')::int`,
      high: sql<number>`count(*) FILTER (WHERE ${incidentsTable.severity} = 'high')::int`,
      critical: sql<number>`count(*) FILTER (WHERE ${incidentsTable.severity} = 'critical')::int`,
    })
    .from(incidentsTable)
    .where(gte(incidentsTable.occurredAt, thirtyDaysAgo))
    .groupBy(sql`TO_CHAR(${incidentsTable.occurredAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${incidentsTable.occurredAt}, 'YYYY-MM-DD')`);

  const result = trends.map((t) => ({
    date: t.date,
    count: t.count,
    bySeverity: {
      low: t.low,
      medium: t.medium,
      high: t.high,
      critical: t.critical,
    },
  }));

  res.json(GetIncidentTrendsResponse.parse(result));
});

export default router;
