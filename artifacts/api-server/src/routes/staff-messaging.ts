import { Router } from "express";
import { db } from "@workspace/db";
import { staffMessagesTable, staffTable, homesTable } from "@workspace/db";
import { eq, desc, and, or, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

async function resolveStaffFromClerk(clerkUserId: string) {
  const { clerkClient } = await import("@clerk/express");
  const user = await clerkClient.users.getUser(clerkUserId);
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (!email) return null;
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.email, email));
  return staff || null;
}

router.get("/messaging/threads", requireAuth, async (req, res) => {
  try {
    const staff = await resolveStaffFromClerk(req.userId!);
    if (!staff) return res.status(403).json({ error: "Staff not found" });

    const threads = await db
      .select({
        threadId: staffMessagesTable.threadId,
        homeId: staffMessagesTable.homeId,
        latestMessage: sql<string>`(SELECT message FROM staff_messages sm2 WHERE sm2.thread_id = ${staffMessagesTable.threadId} ORDER BY created_at DESC LIMIT 1)`,
        latestSender: sql<string>`(SELECT sender_name FROM staff_messages sm2 WHERE sm2.thread_id = ${staffMessagesTable.threadId} ORDER BY created_at DESC LIMIT 1)`,
        latestTime: sql<Date>`MAX(${staffMessagesTable.createdAt})`,
        unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${staffMessagesTable.isRead} = false AND ${staffMessagesTable.receiverId} = ${staff.id})`,
        messageCount: count(),
      })
      .from(staffMessagesTable)
      .where(
        or(
          eq(staffMessagesTable.senderId, staff.id),
          eq(staffMessagesTable.receiverId, staff.id),
          eq(staffMessagesTable.messageType, "broadcast")
        )
      )
      .groupBy(staffMessagesTable.threadId, staffMessagesTable.homeId)
      .orderBy(sql`MAX(${staffMessagesTable.createdAt}) DESC`);

    res.json(threads);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/messaging/thread/:threadId", requireAuth, async (req, res) => {
  try {
    const staff = await resolveStaffFromClerk(req.userId!);
    if (!staff) return res.status(403).json({ error: "Staff not found" });

    const messages = await db
      .select()
      .from(staffMessagesTable)
      .where(eq(staffMessagesTable.threadId, req.params.threadId))
      .orderBy(staffMessagesTable.createdAt);

    const isParticipant = messages.some(
      (m) => m.senderId === staff.id || m.receiverId === staff.id || m.messageType === "broadcast"
    );
    if (!isParticipant) return res.status(403).json({ error: "Not a participant in this thread" });

    res.json(messages);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/messaging/send", requireAuth, async (req, res) => {
  try {
    const staff = await resolveStaffFromClerk(req.userId!);
    if (!staff) return res.status(403).json({ error: "Staff not found" });

    const { receiverId, homeId, message, urgency, messageType, threadId } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (messageType !== "broadcast" && !receiverId) {
      return res.status(400).json({ error: "receiverId is required for direct messages" });
    }

    let receiverName: string | null = null;
    if (receiverId) {
      const [receiver] = await db.select().from(staffTable).where(eq(staffTable.id, receiverId));
      if (!receiver) return res.status(404).json({ error: "Receiver not found" });
      receiverName = `${receiver.firstName} ${receiver.lastName}`;
    }

    const actualThreadId = threadId || `thread-${staff.id}-${receiverId || "broadcast"}-${Date.now()}`;

    const [msg] = await db.insert(staffMessagesTable).values({
      threadId: actualThreadId,
      homeId: homeId || null,
      senderId: staff.id,
      senderName: `${staff.firstName} ${staff.lastName}`,
      receiverId: receiverId || null,
      receiverName,
      message: message.trim(),
      urgency: urgency || "normal",
      messageType: messageType || "direct",
      isRead: false,
    }).returning();

    res.status(201).json(msg);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/messaging/read/:threadId", requireAuth, async (req, res) => {
  try {
    const staff = await resolveStaffFromClerk(req.userId!);
    if (!staff) return res.status(403).json({ error: "Staff not found" });

    await db
      .update(staffMessagesTable)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(staffMessagesTable.threadId, req.params.threadId),
          eq(staffMessagesTable.receiverId, staff.id),
          eq(staffMessagesTable.isRead, false)
        )
      );

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/messaging/unread-count", requireAuth, async (req, res) => {
  try {
    const staff = await resolveStaffFromClerk(req.userId!);
    if (!staff) return res.status(403).json({ error: "Staff not found" });

    const [result] = await db
      .select({ count: count() })
      .from(staffMessagesTable)
      .where(
        and(
          eq(staffMessagesTable.receiverId, staff.id),
          eq(staffMessagesTable.isRead, false)
        )
      );

    res.json({ unread: result?.count || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/messaging/contacts", requireAuth, async (req, res) => {
  try {
    const staff = await resolveStaffFromClerk(req.userId!);
    if (!staff) return res.status(403).json({ error: "Staff not found" });

    const allStaff = await db
      .select({
        id: staffTable.id,
        firstName: staffTable.firstName,
        lastName: staffTable.lastName,
        role: staffTable.role,
        homeId: staffTable.homeId,
        status: staffTable.status,
      })
      .from(staffTable)
      .where(eq(staffTable.status, "active"));

    const contacts = allStaff.filter(s => s.id !== staff.id);
    res.json(contacts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
