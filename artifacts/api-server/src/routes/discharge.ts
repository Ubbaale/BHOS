import { Router } from "express";
import { db } from "@workspace/db";
import { dischargePlansTable, aftercareFollowupsTable, patientsTable, homesTable } from "@workspace/db";
import { eq, desc, and, count, gte, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

router.get("/discharge/plans", requireAuth, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const homeId = req.query.homeId ? Number(req.query.homeId) : undefined;
    const conditions = [];
    if (status) conditions.push(eq(dischargePlansTable.status, status));
    if (homeId) conditions.push(eq(dischargePlansTable.homeId, homeId));
    const plans = conditions.length > 0
      ? await db.select().from(dischargePlansTable).where(and(...conditions)).orderBy(desc(dischargePlansTable.createdAt))
      : await db.select().from(dischargePlansTable).orderBy(desc(dischargePlansTable.createdAt));
    const enriched = [];
    for (const plan of plans) {
      const [patient] = await db.select({ firstName: patientsTable.firstName, lastName: patientsTable.lastName }).from(patientsTable).where(eq(patientsTable.id, plan.patientId));
      const [home] = await db.select({ name: homesTable.name }).from(homesTable).where(eq(homesTable.id, plan.homeId));
      const [followupCount] = await db.select({ count: count() }).from(aftercareFollowupsTable).where(eq(aftercareFollowupsTable.dischargePlanId, plan.id));
      enriched.push({ ...plan, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", homeName: home?.name, followupCount: followupCount?.count || 0 });
    }
    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/discharge/plans/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(dischargePlansTable).where(eq(dischargePlansTable.id, id));
    if (!plan) return res.status(404).json({ error: "Discharge plan not found" });
    const [patient] = await db.select({ firstName: patientsTable.firstName, lastName: patientsTable.lastName }).from(patientsTable).where(eq(patientsTable.id, plan.patientId));
    const [home] = await db.select({ name: homesTable.name }).from(homesTable).where(eq(homesTable.id, plan.homeId));
    const followups = await db.select().from(aftercareFollowupsTable).where(eq(aftercareFollowupsTable.dischargePlanId, id)).orderBy(aftercareFollowupsTable.scheduledDate);
    res.json({ ...plan, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", homeName: home?.name, followups });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/discharge/plans", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const { patientId, homeId, dischargeType, plannedDate, dischargeReason, dischargeTo, dischargeAddress, aftercarePlan, medicationTransitionPlan, followUpProviders, communityResources, safetyPlan, clinicianName, notes } = req.body;
    if (!patientId || !homeId) return res.status(400).json({ error: "patientId, homeId required" });
    const [plan] = await db.insert(dischargePlansTable).values({
      patientId, homeId, dischargeType: dischargeType || "planned", plannedDate, dischargeReason, dischargeTo, dischargeAddress,
      aftercarePlan, medicationTransitionPlan, followUpProviders, communityResources, safetyPlan, clinicianName, notes,
    }).returning();
    res.status(201).json(plan);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/discharge/plans/:id", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = {};
    const allowed = ["status", "dischargeType", "plannedDate", "actualDate", "dischargeReason", "dischargeTo", "dischargeAddress", "aftercarePlan", "medicationTransitionPlan", "followUpProviders", "communityResources", "safetyPlan", "transportationArranged", "housingSecured", "insuranceContinuity", "belongingsReturned", "finalAssessmentCompleted", "consentForReleaseObtained", "dischargeSummary", "clinicianName", "clinicianSignedAt", "notes"];
    for (const f of allowed) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }
    updates.updatedAt = new Date();
    const [updated] = await db.update(dischargePlansTable).set(updates).where(eq(dischargePlansTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Discharge plan not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/discharge/followups", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const [followup] = await db.insert(aftercareFollowupsTable).values(req.body).returning();
    res.status(201).json(followup);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/discharge/followups/:id", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = {};
    const allowed = ["completedDate", "contactedBy", "outcome", "patientStatus", "currentLiving", "medicationAdherence", "followingUpWithProviders", "concerns", "actionItems", "nextFollowUpDate", "status", "notes"];
    for (const f of allowed) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }
    const [updated] = await db.update(aftercareFollowupsTable).set(updates).where(eq(aftercareFollowupsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Follow-up not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/discharge/dashboard", requireAuth, async (_req, res) => {
  try {
    const [planning] = await db.select({ count: count() }).from(dischargePlansTable).where(eq(dischargePlansTable.status, "planning"));
    const [readyForDischarge] = await db.select({ count: count() }).from(dischargePlansTable).where(eq(dischargePlansTable.status, "ready"));
    const [discharged] = await db.select({ count: count() }).from(dischargePlansTable).where(eq(dischargePlansTable.status, "completed"));
    const [pendingFollowups] = await db.select({ count: count() }).from(aftercareFollowupsTable).where(eq(aftercareFollowupsTable.status, "scheduled"));
    const [completedFollowups] = await db.select({ count: count() }).from(aftercareFollowupsTable).where(eq(aftercareFollowupsTable.status, "completed"));
    const upcoming = await db.select().from(dischargePlansTable).where(and(eq(dischargePlansTable.status, "ready"))).orderBy(dischargePlansTable.plannedDate).limit(10);
    const enrichedUpcoming = [];
    for (const plan of upcoming) {
      const [patient] = await db.select({ firstName: patientsTable.firstName, lastName: patientsTable.lastName }).from(patientsTable).where(eq(patientsTable.id, plan.patientId));
      const [home] = await db.select({ name: homesTable.name }).from(homesTable).where(eq(homesTable.id, plan.homeId));
      enrichedUpcoming.push({ ...plan, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", homeName: home?.name });
    }
    res.json({
      planning: planning?.count || 0,
      readyForDischarge: readyForDischarge?.count || 0,
      discharged: discharged?.count || 0,
      pendingFollowups: pendingFollowups?.count || 0,
      completedFollowups: completedFollowups?.count || 0,
      upcomingDischarges: enrichedUpcoming,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
