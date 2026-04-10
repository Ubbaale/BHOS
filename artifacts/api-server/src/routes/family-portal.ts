import { Router } from "express";
import {
  db,
  familyMembersTable,
  familyNotificationsTable,
  dailySummariesTable,
  careMessagesTable,
  consentDocumentsTable,
  patientsTable,
  medicationAdministrationsTable,
  incidentsTable,
  dailyLogsTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import crypto from "crypto";

const router = Router();

// ── FAMILY MEMBERS ──

router.get("/family/members", requireAuth, async (req, res) => {
  try {
    const { patientId } = req.query;
    const conditions: any[] = [];
    if (patientId) conditions.push(eq(familyMembersTable.patientId, parseInt(patientId as string)));

    const members = await db
      .select({
        id: familyMembersTable.id,
        patientId: familyMembersTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        firstName: familyMembersTable.firstName,
        lastName: familyMembersTable.lastName,
        email: familyMembersTable.email,
        phone: familyMembersTable.phone,
        relationship: familyMembersTable.relationship,
        accessLevel: familyMembersTable.accessLevel,
        isActive: familyMembersTable.isActive,
        notifyByEmail: familyMembersTable.notifyByEmail,
        notifyBySms: familyMembersTable.notifyBySms,
        lastLoginAt: familyMembersTable.lastLoginAt,
        createdAt: familyMembersTable.createdAt,
      })
      .from(familyMembersTable)
      .leftJoin(patientsTable, eq(familyMembersTable.patientId, patientsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(familyMembersTable.createdAt));

    res.json(members);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/family/members", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { patientId, firstName, lastName, email, phone, relationship, accessLevel, notifyByEmail, notifyBySms } = req.body;

    if (!patientId || !firstName || !lastName || !email || !relationship) {
      return res.status(400).json({ error: "patientId, firstName, lastName, email, and relationship are required" });
    }

    const inviteCode = crypto.randomBytes(16).toString("hex");

    const [member] = await db.insert(familyMembersTable).values({
      patientId,
      firstName,
      lastName,
      email,
      phone,
      relationship,
      accessLevel: accessLevel || "read",
      inviteCode,
      isActive: true,
      notifyByEmail: notifyByEmail !== false,
      notifyBySms: notifyBySms || false,
    }).returning();

    res.status(201).json(member);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/family/members/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid member ID" });

    const { accessLevel, isActive, notifyByEmail, notifyBySms } = req.body;
    const updates: any = {};
    if (accessLevel !== undefined) updates.accessLevel = accessLevel;
    if (isActive !== undefined) updates.isActive = isActive;
    if (notifyByEmail !== undefined) updates.notifyByEmail = notifyByEmail;
    if (notifyBySms !== undefined) updates.notifyBySms = notifyBySms;

    const [updated] = await db
      .update(familyMembersTable)
      .set(updates)
      .where(eq(familyMembersTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Family member not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/family/members/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid member ID" });

    const [deactivated] = await db
      .update(familyMembersTable)
      .set({ isActive: false })
      .where(eq(familyMembersTable.id, id))
      .returning();

    if (!deactivated) return res.status(404).json({ error: "Family member not found" });
    res.json({ message: "Family member deactivated", member: deactivated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DAILY SUMMARIES ──

router.get("/family/daily-summaries", requireAuth, async (req, res) => {
  try {
    const { patientId } = req.query;
    const conditions: any[] = [];
    if (patientId) conditions.push(eq(dailySummariesTable.patientId, parseInt(patientId as string)));

    const summaries = await db
      .select({
        id: dailySummariesTable.id,
        patientId: dailySummariesTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        summaryDate: dailySummariesTable.summaryDate,
        moodOverall: dailySummariesTable.moodOverall,
        activitiesCompleted: dailySummariesTable.activitiesCompleted,
        mealsEaten: dailySummariesTable.mealsEaten,
        sleepQuality: dailySummariesTable.sleepQuality,
        medicationAdherence: dailySummariesTable.medicationAdherence,
        incidentCount: dailySummariesTable.incidentCount,
        vitalSignsSummary: dailySummariesTable.vitalSignsSummary,
        staffNotes: dailySummariesTable.staffNotes,
        isPublishedToFamily: dailySummariesTable.isPublishedToFamily,
        publishedAt: dailySummariesTable.publishedAt,
        createdAt: dailySummariesTable.createdAt,
      })
      .from(dailySummariesTable)
      .leftJoin(patientsTable, eq(dailySummariesTable.patientId, patientsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dailySummariesTable.summaryDate));

    res.json(summaries);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/family/daily-summaries/generate", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const { patientId, summaryDate } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    const targetDate = summaryDate ? new Date(summaryDate) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const medAdmins = await db
      .select()
      .from(medicationAdministrationsTable)
      .where(
        and(
          eq(medicationAdministrationsTable.patientId, patientId),
          gte(medicationAdministrationsTable.administeredAt, dayStart),
          lte(medicationAdministrationsTable.administeredAt, dayEnd)
        )
      );

    const incidents = await db
      .select()
      .from(incidentsTable)
      .where(
        and(
          eq(incidentsTable.patientId, patientId),
          gte(incidentsTable.createdAt, dayStart),
          lte(incidentsTable.createdAt, dayEnd)
        )
      );

    const logs = await db
      .select()
      .from(dailyLogsTable)
      .where(
        and(
          eq(dailyLogsTable.patientId, patientId),
          gte(dailyLogsTable.createdAt, dayStart),
          lte(dailyLogsTable.createdAt, dayEnd)
        )
      );

    const totalMeds = medAdmins.length;
    const givenMeds = medAdmins.filter((m) => m.status === "given").length;
    const adherenceRate = totalMeds > 0 ? Math.round((givenMeds / totalMeds) * 100) : 100;

    const moodNotes = logs.map((l) => l.notes).filter(Boolean).join("; ");

    const [summary] = await db.insert(dailySummariesTable).values({
      patientId,
      summaryDate: dayStart,
      moodOverall: moodNotes ? "See staff notes" : "Stable",
      activitiesCompleted: logs.length > 0 ? `${logs.length} daily log entries recorded` : "No activities logged",
      mealsEaten: "Documented in daily logs",
      sleepQuality: "Documented in daily logs",
      medicationAdherence: adherenceRate,
      incidentCount: incidents.length,
      staffNotes: moodNotes || "No additional notes",
      isPublishedToFamily: false,
      generatedBy: req.userId,
    }).returning();

    res.status(201).json(summary);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/family/daily-summaries/:id/publish", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid summary ID" });

    const [updated] = await db
      .update(dailySummariesTable)
      .set({ isPublishedToFamily: true, publishedAt: new Date() })
      .where(eq(dailySummariesTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Summary not found" });

    const familyMembers = await db
      .select()
      .from(familyMembersTable)
      .where(and(eq(familyMembersTable.patientId, updated.patientId), eq(familyMembersTable.isActive, true)));

    for (const member of familyMembers) {
      await db.insert(familyNotificationsTable).values({
        familyMemberId: member.id,
        patientId: updated.patientId,
        type: "daily_summary",
        title: "Daily Summary Available",
        message: `A new daily summary for ${new Date(updated.summaryDate).toLocaleDateString()} has been published.`,
        severity: "info",
      });
    }

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── CARE MESSAGES ──

router.get("/family/messages", requireAuth, async (req, res) => {
  try {
    const { patientId, threadId } = req.query;
    const conditions: any[] = [];
    if (patientId) conditions.push(eq(careMessagesTable.patientId, parseInt(patientId as string)));
    if (threadId) conditions.push(eq(careMessagesTable.threadId, threadId as string));

    const messages = await db
      .select()
      .from(careMessagesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(careMessagesTable.createdAt))
      .limit(100);

    res.json(messages);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/family/messages/threads", requireAuth, async (req, res) => {
  try {
    const threads = await db
      .select({
        threadId: careMessagesTable.threadId,
        patientId: careMessagesTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        lastMessage: sql<string>`(SELECT message FROM care_messages cm2 WHERE cm2.thread_id = ${careMessagesTable.threadId} ORDER BY cm2.created_at DESC LIMIT 1)`,
        lastMessageAt: sql<Date>`MAX(${careMessagesTable.createdAt})`,
        messageCount: sql<number>`COUNT(*)::int`,
        unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${careMessagesTable.isRead} = FALSE AND ${careMessagesTable.senderType} = 'family')::int`,
      })
      .from(careMessagesTable)
      .leftJoin(patientsTable, eq(careMessagesTable.patientId, patientsTable.id))
      .groupBy(careMessagesTable.threadId, careMessagesTable.patientId, patientsTable.firstName, patientsTable.lastName)
      .orderBy(desc(sql`MAX(${careMessagesTable.createdAt})`));

    res.json(threads);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/family/messages", requireAuth, async (req, res) => {
  try {
    const { patientId, threadId, message } = req.body;

    if (!patientId || !message) {
      return res.status(400).json({ error: "patientId and message are required" });
    }

    const actualThreadId = threadId || `thread-${patientId}-${Date.now()}`;

    let senderName = "Care Team";
    try {
      const { clerkClient } = await import("@clerk/express");
      const user = await clerkClient.users.getUser(req.userId!);
      senderName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Care Team";
    } catch {}

    const [msg] = await db.insert(careMessagesTable).values({
      patientId,
      threadId: actualThreadId,
      senderType: "staff",
      senderId: 0,
      senderName,
      message,
      isRead: false,
    }).returning();

    res.status(201).json(msg);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── CONSENT DOCUMENTS ──

router.get("/family/consent-documents", requireAuth, async (req, res) => {
  try {
    const { patientId, status } = req.query;
    const conditions: any[] = [];
    if (patientId) conditions.push(eq(consentDocumentsTable.patientId, parseInt(patientId as string)));
    if (status) conditions.push(eq(consentDocumentsTable.status, status as string));

    const docs = await db
      .select({
        id: consentDocumentsTable.id,
        patientId: consentDocumentsTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        documentType: consentDocumentsTable.documentType,
        title: consentDocumentsTable.title,
        description: consentDocumentsTable.description,
        version: consentDocumentsTable.version,
        status: consentDocumentsTable.status,
        signedByName: consentDocumentsTable.signedByName,
        signedAt: consentDocumentsTable.signedAt,
        expiresAt: consentDocumentsTable.expiresAt,
        createdAt: consentDocumentsTable.createdAt,
      })
      .from(consentDocumentsTable)
      .leftJoin(patientsTable, eq(consentDocumentsTable.patientId, patientsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(consentDocumentsTable.createdAt));

    res.json(docs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/family/consent-documents", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { patientId, documentType, title, description, expiresAt } = req.body;

    if (!patientId || !documentType || !title) {
      return res.status(400).json({ error: "patientId, documentType, and title are required" });
    }

    const [doc] = await db.insert(consentDocumentsTable).values({
      patientId,
      documentType,
      title,
      description,
      status: "pending",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.userId,
    }).returning();

    const familyMembers = await db
      .select()
      .from(familyMembersTable)
      .where(and(eq(familyMembersTable.patientId, patientId), eq(familyMembersTable.isActive, true)));

    for (const member of familyMembers) {
      await db.insert(familyNotificationsTable).values({
        familyMemberId: member.id,
        patientId,
        type: "consent_request",
        title: "New Consent Document",
        message: `A new consent document "${title}" requires your signature.`,
        severity: "warning",
      });
    }

    res.status(201).json(doc);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/family/consent-documents/:id/sign", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });

    const { signedByName, familyMemberId } = req.body;
    if (!signedByName || !familyMemberId) return res.status(400).json({ error: "signedByName and familyMemberId are required" });

    const [doc] = await db.select().from(consentDocumentsTable).where(eq(consentDocumentsTable.id, id));
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.status === "signed") return res.status(400).json({ error: "Document is already signed" });

    const [member] = await db.select().from(familyMembersTable).where(
      and(eq(familyMembersTable.id, familyMemberId), eq(familyMembersTable.patientId, doc.patientId))
    );
    if (!member) return res.status(403).json({ error: "Family member not linked to this patient" });

    const [updated] = await db
      .update(consentDocumentsTable)
      .set({
        status: "signed",
        signedBy: familyMemberId,
        signedByName: `${member.firstName} ${member.lastName}`,
        signedAt: new Date(),
      })
      .where(eq(consentDocumentsTable.id, id))
      .returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── NOTIFICATIONS ──

router.get("/family/notifications", requireAuth, async (req, res) => {
  try {
    const { patientId, unreadOnly } = req.query;
    const conditions: any[] = [];
    if (patientId) conditions.push(eq(familyNotificationsTable.patientId, parseInt(patientId as string)));
    if (unreadOnly === "true") conditions.push(eq(familyNotificationsTable.isRead, false));

    const notifications = await db
      .select({
        id: familyNotificationsTable.id,
        familyMemberId: familyNotificationsTable.familyMemberId,
        patientId: familyNotificationsTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        type: familyNotificationsTable.type,
        title: familyNotificationsTable.title,
        message: familyNotificationsTable.message,
        severity: familyNotificationsTable.severity,
        isRead: familyNotificationsTable.isRead,
        createdAt: familyNotificationsTable.createdAt,
      })
      .from(familyNotificationsTable)
      .leftJoin(patientsTable, eq(familyNotificationsTable.patientId, patientsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(familyNotificationsTable.createdAt))
      .limit(50);

    res.json(notifications);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── FAMILY PORTAL DASHBOARD STATS ──

router.get("/family/dashboard", requireAuth, async (_req, res) => {
  try {
    const [memberCount] = await db.select({ count: sql<number>`count(*)::int` }).from(familyMembersTable).where(eq(familyMembersTable.isActive, true));
    const [pendingConsent] = await db.select({ count: sql<number>`count(*)::int` }).from(consentDocumentsTable).where(eq(consentDocumentsTable.status, "pending"));
    const [unreadMessages] = await db.select({ count: sql<number>`count(*)::int` }).from(careMessagesTable).where(and(eq(careMessagesTable.isRead, false), eq(careMessagesTable.senderType, "family")));
    const [unpublishedSummaries] = await db.select({ count: sql<number>`count(*)::int` }).from(dailySummariesTable).where(eq(dailySummariesTable.isPublishedToFamily, false));

    res.json({
      activeFamilyMembers: memberCount?.count || 0,
      pendingConsent: pendingConsent?.count || 0,
      unreadMessages: unreadMessages?.count || 0,
      unpublishedSummaries: unpublishedSummaries?.count || 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
