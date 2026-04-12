import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, externalProvidersTable, careReferralsTable, communicationLogsTable, staffTable } from "@workspace/db";
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

router.get("/external-providers", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const providers = await db.select().from(externalProvidersTable).where(eq(externalProvidersTable.orgId, staff.orgId)).orderBy(externalProvidersTable.providerName);
    res.json(providers);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/external-providers", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["providerName", "providerType", "specialty", "organization", "phone", "fax", "email", "address", "npiNumber", "licenseNumber", "notes"]);
    const [p] = await db.insert(externalProvidersTable).values({ ...data, orgId: staff.orgId } as any).returning();
    res.status(201).json(p);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/external-providers/:id", requireAuth, async (req: any, res) => {
  try {
    const data = pick(req.body, ["providerName", "providerType", "specialty", "organization", "phone", "fax", "email", "address", "npiNumber", "licenseNumber", "status", "notes"]);
    const [p] = await db.update(externalProvidersTable).set(data as any).where(eq(externalProvidersTable.id, Number(req.params.id))).returning();
    res.json(p);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/referrals", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const refs = await db.select().from(careReferralsTable).where(eq(careReferralsTable.orgId, staff.orgId)).orderBy(desc(careReferralsTable.createdAt));
    res.json(refs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/referrals", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["patientId", "referralType", "referredFrom", "referredTo", "externalProviderId", "reason", "urgency", "scheduledDate", "notes"]);
    const [ref] = await db.insert(careReferralsTable).values({ ...data, orgId: staff.orgId, createdBy: staff.id } as any).returning();
    res.status(201).json(ref);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/referrals/:id", requireAuth, async (req: any, res) => {
  try {
    const data = pick(req.body, ["status", "scheduledDate", "completedDate", "outcome", "notes"]);
    const [ref] = await db.update(careReferralsTable).set(data as any).where(eq(careReferralsTable.id, Number(req.params.id))).returning();
    res.json(ref);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/communication-logs", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const logs = await db.select().from(communicationLogsTable).where(eq(communicationLogsTable.orgId, staff.orgId)).orderBy(desc(communicationLogsTable.contactedAt)).limit(200);
    res.json(logs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/communication-logs", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["patientId", "externalProviderId", "communicationType", "direction", "subject", "summary", "followUpNeeded", "followUpDate"]);
    const [log] = await db.insert(communicationLogsTable).values({ ...data, orgId: staff.orgId, contactedBy: staff.id } as any).returning();
    res.status(201).json(log);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
