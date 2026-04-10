import { Router } from "express";
import { db } from "@workspace/db";
import { censusRecordsTable, bedAssignmentsTable, homesTable, patientsTable } from "@workspace/db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

router.get("/census/bed-board", requireAuth, async (req, res) => {
  try {
    const homeId = req.query.homeId ? Number(req.query.homeId) : undefined;

    let query = db.select().from(bedAssignmentsTable).where(eq(bedAssignmentsTable.status, "occupied"));
    if (homeId) {
      const beds = await db.select().from(bedAssignmentsTable)
        .where(and(eq(bedAssignmentsTable.homeId, homeId), eq(bedAssignmentsTable.status, "occupied")));
      const enriched = [];
      for (const bed of beds) {
        const [patient] = await db.select({ firstName: patientsTable.firstName, lastName: patientsTable.lastName })
          .from(patientsTable).where(eq(patientsTable.id, bed.patientId));
        const [home] = await db.select({ name: homesTable.name }).from(homesTable).where(eq(homesTable.id, bed.homeId));
        enriched.push({ ...bed, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", homeName: home?.name });
      }
      return res.json(enriched);
    }

    const beds = await db.select().from(bedAssignmentsTable).where(eq(bedAssignmentsTable.status, "occupied"));
    const enriched = [];
    for (const bed of beds) {
      const [patient] = await db.select({ firstName: patientsTable.firstName, lastName: patientsTable.lastName })
        .from(patientsTable).where(eq(patientsTable.id, bed.patientId));
      const [home] = await db.select({ name: homesTable.name }).from(homesTable).where(eq(homesTable.id, bed.homeId));
      enriched.push({ ...bed, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", homeName: home?.name });
    }
    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/census/summary", requireAuth, async (_req, res) => {
  try {
    const homes = await db.select().from(homesTable).where(eq(homesTable.status, "active"));
    const summary = [];
    for (const home of homes) {
      const [occupied] = await db.select({ count: count() }).from(bedAssignmentsTable)
        .where(and(eq(bedAssignmentsTable.homeId, home.id), eq(bedAssignmentsTable.status, "occupied")));
      summary.push({
        homeId: home.id,
        homeName: home.name,
        totalBeds: home.capacity,
        occupiedBeds: occupied?.count || 0,
        availableBeds: home.capacity - (occupied?.count || 0),
        occupancyRate: home.capacity > 0 ? Math.round(((occupied?.count || 0) / home.capacity) * 100) : 0,
      });
    }
    const totalBeds = summary.reduce((a, b) => a + b.totalBeds, 0);
    const totalOccupied = summary.reduce((a, b) => a + b.occupiedBeds, 0);
    res.json({
      homes: summary,
      totals: { totalBeds, totalOccupied, totalAvailable: totalBeds - totalOccupied, overallOccupancyRate: totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0 },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/census/bed-assignments", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const { homeId, patientId, bedNumber, roomNumber, floor, wing, notes } = req.body;
    if (!homeId || !patientId || !bedNumber) return res.status(400).json({ error: "homeId, patientId, bedNumber required" });

    const [existing] = await db.select().from(bedAssignmentsTable)
      .where(and(eq(bedAssignmentsTable.patientId, patientId), eq(bedAssignmentsTable.status, "occupied")));
    if (existing) return res.status(400).json({ error: "Patient already has an active bed assignment" });

    const [bedTaken] = await db.select().from(bedAssignmentsTable)
      .where(and(eq(bedAssignmentsTable.homeId, homeId), eq(bedAssignmentsTable.bedNumber, bedNumber), eq(bedAssignmentsTable.status, "occupied")));
    if (bedTaken) return res.status(400).json({ error: "This bed is already occupied" });

    const [assignment] = await db.insert(bedAssignmentsTable).values({ homeId, patientId, bedNumber, roomNumber, floor, wing, notes }).returning();
    res.status(201).json(assignment);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/census/bed-assignments/:id/vacate", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(bedAssignmentsTable).set({ status: "vacated", vacatedAt: new Date() }).where(eq(bedAssignmentsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Bed assignment not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/census/records", requireAuth, async (req, res) => {
  try {
    const homeId = req.query.homeId ? Number(req.query.homeId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 30;

    let records;
    if (homeId) {
      records = await db.select().from(censusRecordsTable).where(eq(censusRecordsTable.homeId, homeId)).orderBy(desc(censusRecordsTable.recordDate)).limit(limit);
    } else {
      records = await db.select().from(censusRecordsTable).orderBy(desc(censusRecordsTable.recordDate)).limit(limit);
    }
    res.json(records);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/census/records", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const [record] = await db.insert(censusRecordsTable).values(req.body).returning();
    res.status(201).json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
