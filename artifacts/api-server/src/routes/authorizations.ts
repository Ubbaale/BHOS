import { Router, type IRouter } from "express";
import { eq, and, desc, lte } from "drizzle-orm";
import { db, authorizationsTable, authorizationHistoryTable, staffTable } from "@workspace/db";
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

router.get("/authorizations", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const auths = await db.select().from(authorizationsTable).where(eq(authorizationsTable.orgId, staff.orgId)).orderBy(desc(authorizationsTable.createdAt));
    res.json(auths);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/authorizations/expiring/soon", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiring = await db.select().from(authorizationsTable).where(and(eq(authorizationsTable.orgId, staff.orgId), eq(authorizationsTable.status, "active"), lte(authorizationsTable.endDate, thirtyDays))).orderBy(authorizationsTable.endDate);
    res.json(expiring);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/authorizations/:id", requireAuth, async (req: any, res) => {
  try {
    const [auth] = await db.select().from(authorizationsTable).where(eq(authorizationsTable.id, Number(req.params.id)));
    if (!auth) return res.status(404).json({ error: "Not found" });
    const history = await db.select().from(authorizationHistoryTable).where(eq(authorizationHistoryTable.authorizationId, auth.id)).orderBy(desc(authorizationHistoryTable.createdAt));
    res.json({ ...auth, history });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/authorizations", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["patientId", "payerId", "authorizationNumber", "serviceType", "approvedUnits", "unitType", "startDate", "endDate", "requestedDate", "approvedDate", "alertThresholdPercent", "notes"]);
    (data as any).remainingUnits = (data as any).approvedUnits;
    const [auth] = await db.insert(authorizationsTable).values({ ...data, orgId: staff.orgId, requestedBy: staff.id } as any).returning();
    await db.insert(authorizationHistoryTable).values({ authorizationId: auth.id, action: "created", newStatus: "active", performedBy: staff.id, notes: "Authorization created" } as any);
    res.status(201).json(auth);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/authorizations/:id", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    const [existing] = await db.select().from(authorizationsTable).where(eq(authorizationsTable.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: "Not found" });
    const data = pick(req.body, ["status", "approvedUnits", "usedUnits", "endDate", "notes"]);
    if ((data as any).usedUnits !== undefined) {
      (data as any).remainingUnits = (existing.approvedUnits || 0) - ((data as any).usedUnits || 0);
    }
    if ((data as any).approvedUnits !== undefined) {
      (data as any).remainingUnits = ((data as any).approvedUnits || 0) - (existing.usedUnits || 0);
    }
    const [auth] = await db.update(authorizationsTable).set({ ...data, updatedAt: new Date() } as any).where(eq(authorizationsTable.id, Number(req.params.id))).returning();
    await db.insert(authorizationHistoryTable).values({
      authorizationId: auth.id,
      action: "updated",
      previousStatus: existing.status,
      newStatus: auth.status,
      unitsChanged: (data as any).usedUnits ? (data as any).usedUnits - existing.usedUnits : null,
      performedBy: staff?.id,
      notes: req.body.historyNotes || "Authorization updated",
    } as any);
    res.json(auth);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
