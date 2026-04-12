import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, stateReportsTable, reportSchedulesTable, staffTable } from "@workspace/db";
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

router.get("/state-reports", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const reports = await db.select().from(stateReportsTable).where(eq(stateReportsTable.orgId, staff.orgId)).orderBy(desc(stateReportsTable.createdAt));
    res.json(reports);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/state-reports", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["homeId", "reportType", "reportPeriod", "state", "reportData", "submittedTo", "dueDate", "notes"]);
    const [report] = await db.insert(stateReportsTable).values({ ...data, orgId: staff.orgId, createdBy: staff.id } as any).returning();
    res.status(201).json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/state-reports/:id", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    const data = pick(req.body, ["status", "reportData", "submittedTo", "confirmationNumber", "notes"]);
    if (req.body.status === "submitted") {
      (data as any).submittedAt = new Date();
      (data as any).submittedBy = staff?.id;
    }
    const [report] = await db.update(stateReportsTable).set(data as any).where(eq(stateReportsTable.id, Number(req.params.id))).returning();
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/report-schedules", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const schedules = await db.select().from(reportSchedulesTable).where(eq(reportSchedulesTable.orgId, staff.orgId));
    res.json(schedules);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/report-schedules", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["reportType", "state", "frequency", "nextDueDate", "recipientAgency", "submissionMethod"]);
    const [sched] = await db.insert(reportSchedulesTable).values({ ...data, orgId: staff.orgId } as any).returning();
    res.status(201).json(sched);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
