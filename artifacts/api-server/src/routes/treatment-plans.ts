import { Router } from "express";
import { db } from "@workspace/db";
import { treatmentPlansTable, treatmentGoalsTable, goalProgressTable, patientsTable } from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

router.get("/treatment-plans", requireAuth, async (req, res) => {
  try {
    const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
    const status = req.query.status as string | undefined;
    const conditions = [];
    if (patientId) conditions.push(eq(treatmentPlansTable.patientId, patientId));
    if (status) conditions.push(eq(treatmentPlansTable.status, status));
    const plans = conditions.length > 0
      ? await db.select().from(treatmentPlansTable).where(and(...conditions)).orderBy(desc(treatmentPlansTable.createdAt))
      : await db.select().from(treatmentPlansTable).orderBy(desc(treatmentPlansTable.createdAt));
    const enriched = [];
    for (const plan of plans) {
      const [patient] = await db.select({ firstName: patientsTable.firstName, lastName: patientsTable.lastName }).from(patientsTable).where(eq(patientsTable.id, plan.patientId));
      const [goalCount] = await db.select({ count: count() }).from(treatmentGoalsTable).where(eq(treatmentGoalsTable.planId, plan.id));
      enriched.push({ ...plan, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", goalCount: goalCount?.count || 0 });
    }
    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/treatment-plans/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(treatmentPlansTable).where(eq(treatmentPlansTable.id, id));
    if (!plan) return res.status(404).json({ error: "Treatment plan not found" });
    const [patient] = await db.select({ firstName: patientsTable.firstName, lastName: patientsTable.lastName }).from(patientsTable).where(eq(patientsTable.id, plan.patientId));
    const goals = await db.select().from(treatmentGoalsTable).where(eq(treatmentGoalsTable.planId, id)).orderBy(treatmentGoalsTable.priority);
    const goalsWithProgress = [];
    for (const goal of goals) {
      const progress = await db.select().from(goalProgressTable).where(eq(goalProgressTable.goalId, goal.id)).orderBy(desc(goalProgressTable.createdAt)).limit(10);
      goalsWithProgress.push({ ...goal, progress });
    }
    res.json({ ...plan, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", goals: goalsWithProgress });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/treatment-plans", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const { patientId, planType, title, startDate, targetEndDate, reviewFrequency, diagnosis, presentingProblems, strengths, barriers, clinicianName, notes } = req.body;
    if (!patientId || !title || !startDate || !clinicianName) return res.status(400).json({ error: "patientId, title, startDate, clinicianName required" });
    const [plan] = await db.insert(treatmentPlansTable).values({
      patientId, planType: planType || "isp", title, startDate, targetEndDate,
      reviewFrequency: reviewFrequency || "quarterly", diagnosis, presentingProblems, strengths, barriers, clinicianName, notes,
    }).returning();
    res.status(201).json(plan);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/treatment-plans/:id", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = {};
    const allowed = ["title", "status", "targetEndDate", "actualEndDate", "reviewFrequency", "nextReviewDate", "lastReviewDate", "diagnosis", "presentingProblems", "strengths", "barriers", "clinicianName", "clinicianSignature", "patientSignature", "guardianSignature", "notes"];
    for (const f of allowed) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }
    updates.updatedAt = new Date();
    const [updated] = await db.update(treatmentPlansTable).set(updates).where(eq(treatmentPlansTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Treatment plan not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/treatment-plans/:planId/goals", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const planId = parseInt(req.params.planId);
    const { domain, goalStatement, objectiveStatement, interventions, targetDate, priority, measurementCriteria, baselineLevel, targetLevel } = req.body;
    if (!domain || !goalStatement) return res.status(400).json({ error: "domain, goalStatement required" });
    const [goal] = await db.insert(treatmentGoalsTable).values({
      planId, domain, goalStatement, objectiveStatement, interventions, targetDate, priority: priority || "medium", measurementCriteria, baselineLevel, targetLevel,
    }).returning();
    res.status(201).json(goal);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/treatment-plans/goals/:id", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = {};
    const allowed = ["goalStatement", "objectiveStatement", "interventions", "targetDate", "status", "priority", "measurementCriteria", "currentLevel", "progressPercentage"];
    for (const f of allowed) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }
    updates.lastUpdated = new Date();
    const [updated] = await db.update(treatmentGoalsTable).set(updates).where(eq(treatmentGoalsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Goal not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/treatment-plans/goals/:goalId/progress", requireAuth, requireRole("admin", "manager", "nurse", "direct_care"), async (req, res) => {
  try {
    const goalId = parseInt(req.params.goalId);
    const { recordedBy, progressDate, progressNote, rating, statusUpdate } = req.body;
    if (!recordedBy || !progressDate || !progressNote) return res.status(400).json({ error: "recordedBy, progressDate, progressNote required" });
    const [progress] = await db.insert(goalProgressTable).values({ goalId, recordedBy, progressDate, progressNote, rating, statusUpdate }).returning();
    if (statusUpdate) {
      await db.update(treatmentGoalsTable).set({ currentLevel: statusUpdate, lastUpdated: new Date() }).where(eq(treatmentGoalsTable.id, goalId));
    }
    res.status(201).json(progress);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
