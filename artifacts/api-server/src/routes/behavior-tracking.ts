import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, behaviorDefinitionsTable, behaviorIncidentsTable, behaviorInterventionPlansTable, patientsTable, staffTable } from "@workspace/db";
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

router.get("/behavior-definitions", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const defs = await db.select().from(behaviorDefinitionsTable).where(eq(behaviorDefinitionsTable.orgId, staff.orgId)).orderBy(behaviorDefinitionsTable.behaviorName);
    res.json(defs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/behavior-definitions", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["patientId", "behaviorName", "operationalDefinition", "category", "severity", "measurementType"]);
    const [def] = await db.insert(behaviorDefinitionsTable).values({ ...data, orgId: staff.orgId, createdBy: staff.id } as any).returning();
    res.status(201).json(def);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/behavior-incidents", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const incidents = await db.select().from(behaviorIncidentsTable).where(eq(behaviorIncidentsTable.orgId, staff.orgId)).orderBy(desc(behaviorIncidentsTable.occurredAt)).limit(200);
    res.json(incidents);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/behavior-incidents", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["patientId", "behaviorId", "homeId", "antecedent", "behavior", "consequence", "intensity", "durationMinutes", "location", "interventionUsed", "interventionEffective", "staffPresent", "notes", "occurredAt"]);
    const [inc] = await db.insert(behaviorIncidentsTable).values({ ...data, orgId: staff.orgId, recordedBy: staff.id } as any).returning();
    res.status(201).json(inc);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/behavior-incidents/summary/:patientId", requireAuth, async (req: any, res) => {
  try {
    const patientId = Number(req.params.patientId);
    const incidents = await db.select().from(behaviorIncidentsTable).where(eq(behaviorIncidentsTable.patientId, patientId)).orderBy(desc(behaviorIncidentsTable.occurredAt)).limit(100);
    const byBehavior: Record<number, { count: number; lastOccurred: Date | null }> = {};
    for (const inc of incidents) {
      if (!byBehavior[inc.behaviorId]) byBehavior[inc.behaviorId] = { count: 0, lastOccurred: null };
      byBehavior[inc.behaviorId].count++;
      if (!byBehavior[inc.behaviorId].lastOccurred || inc.occurredAt > byBehavior[inc.behaviorId].lastOccurred!) {
        byBehavior[inc.behaviorId].lastOccurred = inc.occurredAt;
      }
    }
    res.json({ total: incidents.length, byBehavior, recentIncidents: incidents.slice(0, 10) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/behavior-plans", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const plans = await db.select().from(behaviorInterventionPlansTable).where(eq(behaviorInterventionPlansTable.orgId, staff.orgId)).orderBy(desc(behaviorInterventionPlansTable.createdAt));
    res.json(plans);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/behavior-plans", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["patientId", "title", "targetBehaviors", "preventionStrategies", "replacementBehaviors", "consequenceStrategies", "crisisPlan", "effectiveDate", "reviewDate"]);
    const [plan] = await db.insert(behaviorInterventionPlansTable).values({ ...data, orgId: staff.orgId, createdBy: staff.id } as any).returning();
    res.status(201).json(plan);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
