import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, documentsTable, documentSignaturesTable, documentTemplatesTable, documentFoldersTable, staffTable } from "@workspace/db";
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

router.get("/documents", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const docs = await db.select().from(documentsTable).where(eq(documentsTable.orgId, staff.orgId)).orderBy(desc(documentsTable.createdAt));
    res.json(docs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/documents", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["title", "description", "fileUrl", "fileType", "fileSizeBytes", "category", "tags", "folderId", "patientId", "requiresSignature"]);
    const [doc] = await db.insert(documentsTable).values({ ...data, orgId: staff.orgId, uploadedBy: staff.id } as any).returning();
    res.status(201).json(doc);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/documents/:id", requireAuth, async (req: any, res) => {
  try {
    const data = pick(req.body, ["title", "description", "category", "tags", "status", "folderId"]);
    const [doc] = await db.update(documentsTable).set({ ...data, updatedAt: new Date() } as any).where(eq(documentsTable.id, Number(req.params.id))).returning();
    res.json(doc);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/documents/:id", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    await db.delete(documentsTable).where(eq(documentsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/documents/:id/signatures", requireAuth, async (req: any, res) => {
  try {
    const sigs = await db.select().from(documentSignaturesTable).where(eq(documentSignaturesTable.documentId, Number(req.params.id)));
    res.json(sigs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/documents/:id/signatures", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    const data = pick(req.body, ["signerName", "signerRole", "signerEmail", "signatureData", "signatureType"]);
    const [sig] = await db.insert(documentSignaturesTable).values({ ...data, documentId: Number(req.params.id), signedBy: staff?.id, ipAddress: req.ip } as any).returning();
    res.status(201).json(sig);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/document-templates", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const templates = await db.select().from(documentTemplatesTable).where(eq(documentTemplatesTable.orgId, staff.orgId));
    res.json(templates);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/document-templates", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["name", "category", "content", "fields", "requiresSignature"]);
    const [t] = await db.insert(documentTemplatesTable).values({ ...data, orgId: staff.orgId, createdBy: staff.id } as any).returning();
    res.status(201).json(t);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/document-folders", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const folders = await db.select().from(documentFoldersTable).where(eq(documentFoldersTable.orgId, staff.orgId));
    res.json(folders);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/document-folders", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization" });
    const data = pick(req.body, ["name", "description", "parentId"]);
    const [f] = await db.insert(documentFoldersTable).values({ ...data, orgId: staff.orgId, createdBy: staff.id } as any).returning();
    res.status(201).json(f);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
