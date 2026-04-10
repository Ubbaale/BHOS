import { Router } from "express";
import { db } from "@workspace/db";
import { referralsTable, intakeAssessmentsTable, waitlistTable, homesTable } from "@workspace/db";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

router.get("/admissions/referrals", requireAuth, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const stage = req.query.stage as string | undefined;
    let query = db.select().from(referralsTable);
    const conditions = [];
    if (status) conditions.push(eq(referralsTable.status, status));
    if (stage) conditions.push(eq(referralsTable.stage, stage));
    const referrals = conditions.length > 0
      ? await db.select().from(referralsTable).where(and(...conditions)).orderBy(desc(referralsTable.createdAt))
      : await db.select().from(referralsTable).orderBy(desc(referralsTable.createdAt));
    res.json(referrals);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admissions/referrals/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.id, id));
    if (!referral) return res.status(404).json({ error: "Referral not found" });
    const assessments = await db.select().from(intakeAssessmentsTable).where(eq(intakeAssessmentsTable.referralId, id));
    res.json({ ...referral, assessments });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admissions/referrals", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, phone, email, referralSource, referralSourceName, referralSourcePhone, diagnosis, insuranceProvider, insurancePolicyNumber, priorityLevel, homeId, notes } = req.body;
    if (!firstName || !lastName || !referralSource) return res.status(400).json({ error: "firstName, lastName, referralSource required" });
    const [referral] = await db.insert(referralsTable).values({
      firstName, lastName, dateOfBirth, phone, email, referralSource, referralSourceName, referralSourcePhone,
      diagnosis, insuranceProvider, insurancePolicyNumber, priorityLevel: priorityLevel || "normal",
      homeId, notes, status: "inquiry", stage: "new_lead",
    }).returning();
    res.status(201).json(referral);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/admissions/referrals/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = {};
    const allowed = ["status", "stage", "homeId", "priorityLevel", "assignedTo", "estimatedAdmissionDate", "actualAdmissionDate", "denialReason", "convertedPatientId", "notes"];
    for (const f of allowed) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }
    updates.updatedAt = new Date();
    const [updated] = await db.update(referralsTable).set(updates).where(eq(referralsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Referral not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admissions/pipeline", requireAuth, async (_req, res) => {
  try {
    const stages = ["new_lead", "contacted", "screening", "assessment", "insurance_verification", "waitlist", "approved", "admitted", "denied"];
    const pipeline: Record<string, any[]> = {};
    for (const stage of stages) {
      pipeline[stage] = await db.select().from(referralsTable).where(eq(referralsTable.stage, stage)).orderBy(desc(referralsTable.createdAt));
    }
    res.json(pipeline);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admissions/dashboard", requireAuth, async (_req, res) => {
  try {
    const [totalRef] = await db.select({ count: count() }).from(referralsTable);
    const [activeRef] = await db.select({ count: count() }).from(referralsTable).where(
      and(sql`${referralsTable.stage} NOT IN ('admitted', 'denied')`)
    );
    const [admittedRef] = await db.select({ count: count() }).from(referralsTable).where(eq(referralsTable.stage, "admitted"));
    const [deniedRef] = await db.select({ count: count() }).from(referralsTable).where(eq(referralsTable.stage, "denied"));
    const [waitlistCount] = await db.select({ count: count() }).from(waitlistTable).where(eq(waitlistTable.status, "waiting"));

    const sourceCounts = await db.select({
      source: referralsTable.referralSource,
      count: count(),
    }).from(referralsTable).groupBy(referralsTable.referralSource);

    res.json({
      totalReferrals: totalRef?.count || 0,
      activeReferrals: activeRef?.count || 0,
      admitted: admittedRef?.count || 0,
      denied: deniedRef?.count || 0,
      waitlistSize: waitlistCount?.count || 0,
      referralSources: sourceCounts,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admissions/assessments", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const [assessment] = await db.insert(intakeAssessmentsTable).values(req.body).returning();
    res.status(201).json(assessment);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admissions/waitlist", requireAuth, async (_req, res) => {
  try {
    const items = await db.select().from(waitlistTable).where(eq(waitlistTable.status, "waiting")).orderBy(waitlistTable.position);
    const enriched = [];
    for (const item of items) {
      const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.id, item.referralId));
      const home = item.homeId ? (await db.select({ name: homesTable.name }).from(homesTable).where(eq(homesTable.id, item.homeId)))[0] : null;
      enriched.push({ ...item, referralName: referral ? `${referral.firstName} ${referral.lastName}` : "Unknown", homeName: home?.name });
    }
    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admissions/waitlist", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { referralId, homeId, priority, reason } = req.body;
    const [maxPos] = await db.select({ max: sql<number>`COALESCE(MAX(position), 0)` }).from(waitlistTable).where(eq(waitlistTable.status, "waiting"));
    const [item] = await db.insert(waitlistTable).values({ referralId, homeId, position: (maxPos?.max || 0) + 1, priority: priority || "normal", reason }).returning();
    await db.update(referralsTable).set({ stage: "waitlist" }).where(eq(referralsTable.id, referralId));
    res.status(201).json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
