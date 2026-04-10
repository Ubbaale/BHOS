import { Router } from "express";
import { db } from "@workspace/db";
import { progressNotesTable, patientsTable, staffTable } from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

router.get("/progress-notes", requireAuth, async (req, res) => {
  try {
    const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
    const noteType = req.query.noteType as string | undefined;
    const status = req.query.status as string | undefined;
    const conditions = [];
    if (patientId) conditions.push(eq(progressNotesTable.patientId, patientId));
    if (noteType) conditions.push(eq(progressNotesTable.noteType, noteType));
    if (status) conditions.push(eq(progressNotesTable.status, status));
    const notes = conditions.length > 0
      ? await db.select().from(progressNotesTable).where(and(...conditions)).orderBy(desc(progressNotesTable.sessionDate))
      : await db.select().from(progressNotesTable).orderBy(desc(progressNotesTable.sessionDate));
    const enriched = [];
    for (const note of notes) {
      const [patient] = await db.select({ firstName: patientsTable.firstName, lastName: patientsTable.lastName }).from(patientsTable).where(eq(patientsTable.id, note.patientId));
      const [staff] = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName }).from(staffTable).where(eq(staffTable.id, note.staffId));
      enriched.push({ ...note, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", staffName: staff ? `${staff.firstName} ${staff.lastName}` : "Unknown" });
    }
    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/progress-notes/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [note] = await db.select().from(progressNotesTable).where(eq(progressNotesTable.id, id));
    if (!note) return res.status(404).json({ error: "Note not found" });
    const [patient] = await db.select({ firstName: patientsTable.firstName, lastName: patientsTable.lastName }).from(patientsTable).where(eq(patientsTable.id, note.patientId));
    const [staff] = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName }).from(staffTable).where(eq(staffTable.id, note.staffId));
    res.json({ ...note, patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown", staffName: staff ? `${staff.firstName} ${staff.lastName}` : "Unknown" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/progress-notes", requireAuth, requireRole("admin", "manager", "nurse", "direct_care"), async (req, res) => {
  try {
    const { patientId, staffId, noteType, sessionType, sessionDate, duration, subjective, objective, assessment, plan, behavior, intervention, response, data, action, narrative, treatmentPlanId, goalIds, moodRating, riskLevel, followUpNeeded, followUpDate } = req.body;
    if (!patientId || !staffId || !sessionDate) return res.status(400).json({ error: "patientId, staffId, sessionDate required" });
    const [note] = await db.insert(progressNotesTable).values({
      patientId, staffId, noteType: noteType || "soap", sessionType: sessionType || "individual",
      sessionDate: new Date(sessionDate), duration, subjective, objective, assessment, plan,
      behavior, intervention, response, data, action, narrative,
      treatmentPlanId, goalIds, moodRating, riskLevel,
      followUpNeeded: followUpNeeded || false, followUpDate: followUpDate ? new Date(followUpDate) : null,
    }).returning();
    res.status(201).json(note);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/progress-notes/:id", requireAuth, requireRole("admin", "manager", "nurse", "direct_care"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = {};
    const allowed = ["subjective", "objective", "assessment", "plan", "behavior", "intervention", "response", "data", "action", "narrative", "moodRating", "riskLevel", "followUpNeeded", "followUpDate", "status", "addendum", "addendumDate"];
    for (const f of allowed) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }
    updates.updatedAt = new Date();
    const [updated] = await db.update(progressNotesTable).set(updates).where(eq(progressNotesTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Note not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/progress-notes/:id/sign", requireAuth, requireRole("admin", "manager", "nurse", "direct_care"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [signed] = await db.update(progressNotesTable).set({ signed: true, signedAt: new Date(), status: "signed" }).where(eq(progressNotesTable.id, id)).returning();
    if (!signed) return res.status(404).json({ error: "Note not found" });
    res.json(signed);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/progress-notes/:id/supervisor-sign", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { supervisorName } = req.body;
    const [signed] = await db.update(progressNotesTable).set({ supervisorReview: true, supervisorName, supervisorSignedAt: new Date() }).where(eq(progressNotesTable.id, id)).returning();
    if (!signed) return res.status(404).json({ error: "Note not found" });
    res.json(signed);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
