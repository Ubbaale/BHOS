import { Router, type IRouter } from "express";
import { eq, and, desc, lte, gte, sql } from "drizzle-orm";
import { db, credentialTypesTable, staffCredentialsTable, credentialAlertsTable, staffTable } from "@workspace/db";
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

router.get("/credential-types", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const types = await db.select().from(credentialTypesTable).where(eq(credentialTypesTable.orgId, staff.orgId)).orderBy(credentialTypesTable.name);
    res.json(types);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/credential-types", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["name", "category", "description", "isRequired", "renewalPeriodMonths", "reminderDaysBefore", "appliesToRoles"]);
    const [t] = await db.insert(credentialTypesTable).values({ ...data, orgId: staff.orgId } as any).returning();
    res.status(201).json(t);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/staff-credentials", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const orgStaff = await db.select({ id: staffTable.id }).from(staffTable).where(eq(staffTable.orgId, staff.orgId));
    const staffIds = orgStaff.map(s => s.id);
    if (staffIds.length === 0) return res.json([]);
    const creds = await db.select().from(staffCredentialsTable).orderBy(desc(staffCredentialsTable.createdAt));
    const filtered = creds.filter(c => staffIds.includes(c.staffId));
    res.json(filtered);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/staff-credentials", requireAuth, async (req: any, res) => {
  try {
    const data = pick(req.body, ["staffId", "credentialTypeId", "credentialName", "credentialNumber", "issuingAuthority", "issueDate", "expirationDate", "documentUrl", "notes"]);
    const [cred] = await db.insert(staffCredentialsTable).values(data as any).returning();
    res.status(201).json(cred);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/staff-credentials/:id", requireAuth, async (req: any, res) => {
  try {
    const data = pick(req.body, ["credentialName", "credentialNumber", "issuingAuthority", "issueDate", "expirationDate", "documentUrl", "status", "notes"]);
    const [cred] = await db.update(staffCredentialsTable).set({ ...data, updatedAt: new Date() } as any).where(eq(staffCredentialsTable.id, Number(req.params.id))).returning();
    res.json(cred);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/staff-credentials/:id/verify", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    const [cred] = await db.update(staffCredentialsTable).set({ verifiedBy: staff?.id, verifiedAt: new Date(), updatedAt: new Date() }).where(eq(staffCredentialsTable.id, Number(req.params.id))).returning();
    res.json(cred);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/staff-credentials/expiring", requireAuth, async (req: any, res) => {
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiring = await db.select().from(staffCredentialsTable).where(and(eq(staffCredentialsTable.status, "active"), lte(staffCredentialsTable.expirationDate, thirtyDaysFromNow))).orderBy(staffCredentialsTable.expirationDate);
    res.json(expiring);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/credential-alerts", requireAuth, async (req: any, res) => {
  try {
    const alerts = await db.select().from(credentialAlertsTable).where(eq(credentialAlertsTable.acknowledged, false)).orderBy(desc(credentialAlertsTable.createdAt));
    res.json(alerts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
