import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ispPlansTable, ispGoalsTable, ispObjectivesTable, ispProgressTable, patientsTable, staffTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function pick<T extends Record<string, any>>(obj: T, keys: readonly string[]): Partial<T> {
  const result: any = {};
  for (const k of keys) { if (k in obj) result[k] = obj[k]; }
  return result;
}

async function resolveCallerStaff(userId: string) {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, userId)).limit(1);
  return staff ?? null;
}

router.get("/isp", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const plans = await db.select().from(ispPlansTable).where(eq(ispPlansTable.orgId, staff.orgId)).orderBy(desc(ispPlansTable.createdAt));
    res.json(plans);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/isp/:id", requireAuth, async (req: any, res) => {
  try {
    const [plan] = await db.select().from(ispPlansTable).where(eq(ispPlansTable.id, Number(req.params.id)));
    if (!plan) return res.status(404).json({ error: "Not found" });
    const goals = await db.select().from(ispGoalsTable).where(eq(ispGoalsTable.ispId, plan.id)).orderBy(ispGoalsTable.priority);
    const goalIds = goals.map(g => g.id);
    let objectives: any[] = [];
    if (goalIds.length > 0) {
      objectives = await db.select().from(ispObjectivesTable).where(eq(ispObjectivesTable.goalId, goalIds[0]));
      for (let i = 1; i < goalIds.length; i++) {
        const more = await db.select().from(ispObjectivesTable).where(eq(ispObjectivesTable.goalId, goalIds[i]));
        objectives = objectives.concat(more);
      }
    }
    res.json({ ...plan, goals: goals.map(g => ({ ...g, objectives: objectives.filter(o => o.goalId === g.id) })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/isp", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["patientId", "title", "planType", "effectiveDate", "reviewDate", "expirationDate", "notes"]);
    const [plan] = await db.insert(ispPlansTable).values({ ...data, orgId: staff.orgId, createdBy: staff.id } as any).returning();
    res.status(201).json(plan);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/isp/:id", requireAuth, async (req: any, res) => {
  try {
    const data = pick(req.body, ["title", "status", "effectiveDate", "reviewDate", "expirationDate", "notes"]);
    const [plan] = await db.update(ispPlansTable).set({ ...data, updatedAt: new Date() } as any).where(eq(ispPlansTable.id, Number(req.params.id))).returning();
    res.json(plan);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/isp/:id/goals", requireAuth, async (req: any, res) => {
  try {
    const data = pick(req.body, ["domain", "goalStatement", "baselineBehavior", "targetBehavior", "measurementMethod", "targetDate", "priority"]);
    const [goal] = await db.insert(ispGoalsTable).values({ ...data, ispId: Number(req.params.id) } as any).returning();
    res.status(201).json(goal);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/isp/goals/:goalId/objectives", requireAuth, async (req: any, res) => {
  try {
    const data = pick(req.body, ["objectiveStatement", "criteria", "staffResponsibility", "frequency"]);
    const [obj] = await db.insert(ispObjectivesTable).values({ ...data, goalId: Number(req.params.goalId) } as any).returning();
    res.status(201).json(obj);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/isp/progress", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    const data = pick(req.body, ["objectiveId", "patientId", "progressRating", "dataValue", "observation"]);
    const [p] = await db.insert(ispProgressTable).values({ ...data, recordedBy: staff?.id } as any).returning();
    res.status(201).json(p);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
