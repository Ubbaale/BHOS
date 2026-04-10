import { Router } from "express";
import { db } from "@workspace/db";
import { supportTicketsTable, supportTicketMessagesTable, staffTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

async function getStaffContext(req: any) {
  const userId = req.userId;
  if (!userId) return null;
  const [staff] = await db
    .select({
      id: staffTable.id,
      orgId: staffTable.orgId,
      firstName: staffTable.firstName,
      lastName: staffTable.lastName,
      email: staffTable.email,
    })
    .from(staffTable)
    .where(eq(staffTable.clerkUserId, userId))
    .limit(1);
  return staff || null;
}

router.get("/support-tickets", async (req: any, res) => {
  try {
    const staff = await getStaffContext(req);
    if (!staff?.orgId) return res.status(400).json({ error: "Organization required" });

    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.orgId, staff.orgId))
      .orderBy(desc(supportTicketsTable.createdAt));

    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/support-tickets/:id", async (req: any, res) => {
  try {
    const staff = await getStaffContext(req);
    if (!staff?.orgId) return res.status(400).json({ error: "Organization required" });

    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(and(
        eq(supportTicketsTable.id, Number(req.params.id)),
        eq(supportTicketsTable.orgId, staff.orgId)
      ));

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const messages = await db
      .select()
      .from(supportTicketMessagesTable)
      .where(eq(supportTicketMessagesTable.ticketId, ticket.id))
      .orderBy(supportTicketMessagesTable.createdAt);

    res.json({ ...ticket, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/support-tickets", async (req: any, res) => {
  try {
    const staff = await getStaffContext(req);
    if (!staff?.orgId) return res.status(400).json({ error: "Organization required" });

    const { subject, description, category, priority } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ error: "Subject and description are required" });
    }

    const staffName = `${staff.firstName} ${staff.lastName}`;

    const [ticket] = await db.insert(supportTicketsTable).values({
      orgId: staff.orgId,
      subject,
      description,
      category: category || "general",
      priority: priority || "medium",
      createdBy: staff.id,
      createdByName: staffName,
      createdByEmail: staff.email,
    }).returning();

    await db.insert(supportTicketMessagesTable).values({
      ticketId: ticket.id,
      senderType: "user",
      senderName: staffName,
      senderEmail: staff.email,
      message: description,
    });

    res.status(201).json(ticket);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/support-tickets/:id/messages", async (req: any, res) => {
  try {
    const staff = await getStaffContext(req);
    if (!staff?.orgId) return res.status(400).json({ error: "Organization required" });

    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(and(
        eq(supportTicketsTable.id, Number(req.params.id)),
        eq(supportTicketsTable.orgId, staff.orgId)
      ));

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const staffName = `${staff.firstName} ${staff.lastName}`;

    const [msg] = await db.insert(supportTicketMessagesTable).values({
      ticketId: ticket.id,
      senderType: "user",
      senderName: staffName,
      senderEmail: staff.email,
      message,
    }).returning();

    await db.update(supportTicketsTable)
      .set({ updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, ticket.id));

    res.status(201).json(msg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/support-tickets/:id", async (req: any, res) => {
  try {
    const staff = await getStaffContext(req);
    if (!staff?.orgId) return res.status(400).json({ error: "Organization required" });

    const [existing] = await db
      .select()
      .from(supportTicketsTable)
      .where(and(
        eq(supportTicketsTable.id, Number(req.params.id)),
        eq(supportTicketsTable.orgId, staff.orgId)
      ));

    if (!existing) return res.status(404).json({ error: "Ticket not found" });

    const updates: any = { updatedAt: new Date() };
    if (req.body.status) {
      updates.status = req.body.status;
      if (req.body.status === "resolved") updates.resolvedAt = new Date();
    }
    if (req.body.priority) updates.priority = req.body.priority;

    const [ticket] = await db
      .update(supportTicketsTable)
      .set(updates)
      .where(eq(supportTicketsTable.id, Number(req.params.id)))
      .returning();

    res.json(ticket);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
