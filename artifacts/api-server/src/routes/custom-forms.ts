import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, customFormsTable, formSubmissionsTable, staffTable } from "@workspace/db";
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

router.get("/custom-forms", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const forms = await db.select().from(customFormsTable).where(eq(customFormsTable.orgId, staff.orgId)).orderBy(desc(customFormsTable.createdAt));
    res.json(forms);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/custom-forms/:id", requireAuth, async (req: any, res) => {
  try {
    const [form] = await db.select().from(customFormsTable).where(eq(customFormsTable.id, Number(req.params.id)));
    if (!form) return res.status(404).json({ error: "Not found" });
    res.json(form);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/custom-forms", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["name", "description", "category", "formSchema", "isPublished", "isRequired", "frequency"]);
    const [form] = await db.insert(customFormsTable).values({ ...data, orgId: staff.orgId, createdBy: staff.id } as any).returning();
    res.status(201).json(form);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/custom-forms/:id", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const data = pick(req.body, ["name", "description", "category", "formSchema", "isPublished", "isRequired", "frequency", "status"]);
    const [form] = await db.update(customFormsTable).set({ ...data, updatedAt: new Date() } as any).where(eq(customFormsTable.id, Number(req.params.id))).returning();
    res.json(form);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/form-submissions", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const formId = req.query.formId ? Number(req.query.formId) : undefined;
    let subs;
    if (formId) {
      subs = await db.select().from(formSubmissionsTable).where(and(eq(formSubmissionsTable.orgId, staff.orgId), eq(formSubmissionsTable.formId, formId))).orderBy(desc(formSubmissionsTable.submittedAt));
    } else {
      subs = await db.select().from(formSubmissionsTable).where(eq(formSubmissionsTable.orgId, staff.orgId)).orderBy(desc(formSubmissionsTable.submittedAt));
    }
    res.json(subs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/form-submissions", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["formId", "patientId", "formData"]);
    const [sub] = await db.insert(formSubmissionsTable).values({ ...data, orgId: staff.orgId, submittedBy: staff.id } as any).returning();
    res.status(201).json(sub);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/form-submissions/:id/review", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    const [sub] = await db.update(formSubmissionsTable).set({ status: req.body.status || "reviewed", reviewedBy: staff?.id, reviewedAt: new Date(), reviewNotes: req.body.reviewNotes } as any).where(eq(formSubmissionsTable.id, Number(req.params.id))).returning();
    res.json(sub);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
