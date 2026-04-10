import { Router } from "express";
import { db } from "@workspace/db";
import {
  superAdminsTable, supportTicketsTable, supportTicketMessagesTable,
  staffTable, homesTable,
} from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

async function requireSuperAdmin(req: any, res: any, next: any) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [staff] = await db
    .select({ email: staffTable.email })
    .from(staffTable)
    .where(eq(staffTable.clerkUserId, userId))
    .limit(1);

  if (!staff) return res.status(403).json({ error: "Forbidden" });

  const [admin] = await db
    .select()
    .from(superAdminsTable)
    .where(and(eq(superAdminsTable.email, staff.email), eq(superAdminsTable.isActive, true)))
    .limit(1);

  if (!admin) return res.status(403).json({ error: "Super admin access required" });
  (req as any).superAdmin = admin;
  next();
}

router.get("/admin/me", requireSuperAdmin, async (req: any, res) => {
  res.json({ isSuperAdmin: true, admin: (req as any).superAdmin });
});

router.get("/admin/stats", requireSuperAdmin, async (_req, res) => {
  try {
    const [orgCount] = await db
      .select({ count: sql<number>`count(distinct org_id)::int` })
      .from(homesTable);

    const [staffCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(staffTable);

    const [homeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(homesTable);

    const [ticketCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportTicketsTable);

    const [openTickets] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.status, "open"));

    res.json({
      totalOrganizations: orgCount?.count || 0,
      totalStaff: staffCount?.count || 0,
      totalHomes: homeCount?.count || 0,
      totalTickets: ticketCount?.count || 0,
      openTickets: openTickets?.count || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/organizations", requireSuperAdmin, async (_req, res) => {
  try {
    const orgs = await db
      .select({
        orgId: homesTable.orgId,
        homeCount: sql<number>`count(distinct ${homesTable.id})::int`,
        homeNames: sql<string>`string_agg(distinct ${homesTable.name}, ', ')`,
      })
      .from(homesTable)
      .where(sql`${homesTable.orgId} is not null`)
      .groupBy(homesTable.orgId);

    const orgsWithStaff = await Promise.all(
      orgs.map(async (org) => {
        const [staffCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(staffTable)
          .where(eq(staffTable.orgId, org.orgId!));

        const [ticketCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(supportTicketsTable)
          .where(eq(supportTicketsTable.orgId, org.orgId!));

        const [openTicketCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(supportTicketsTable)
          .where(and(
            eq(supportTicketsTable.orgId, org.orgId!),
            eq(supportTicketsTable.status, "open")
          ));

        return {
          ...org,
          staffCount: staffCount?.count || 0,
          ticketCount: ticketCount?.count || 0,
          openTicketCount: openTicketCount?.count || 0,
        };
      })
    );

    res.json(orgsWithStaff);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/organizations/:orgId", requireSuperAdmin, async (req, res) => {
  try {
    const orgId = Number(req.params.orgId);

    const homes = await db
      .select({
        id: homesTable.id,
        name: homesTable.name,
        address: homesTable.address,
        city: homesTable.city,
        state: homesTable.state,
        status: homesTable.status,
        capacity: homesTable.capacity,
        currentOccupancy: homesTable.currentOccupancy,
      })
      .from(homesTable)
      .where(eq(homesTable.orgId, orgId));

    const staff = await db
      .select({
        id: staffTable.id,
        firstName: staffTable.firstName,
        lastName: staffTable.lastName,
        email: staffTable.email,
        role: staffTable.role,
        status: staffTable.status,
      })
      .from(staffTable)
      .where(eq(staffTable.orgId, orgId))
      .orderBy(staffTable.lastName);

    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.orgId, orgId))
      .orderBy(desc(supportTicketsTable.createdAt));

    res.json({ orgId, homes, staff, tickets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/tickets", requireSuperAdmin, async (_req, res) => {
  try {
    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .orderBy(desc(supportTicketsTable.createdAt));

    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/tickets/:id", requireSuperAdmin, async (req, res) => {
  try {
    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, Number(req.params.id)));

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

router.patch("/admin/tickets/:id", requireSuperAdmin, async (req: any, res) => {
  try {
    const updates: any = { updatedAt: new Date() };
    if (req.body.status) {
      updates.status = req.body.status;
      if (req.body.status === "resolved") updates.resolvedAt = new Date();
    }
    if (req.body.priority) updates.priority = req.body.priority;
    if (req.body.assignedTo !== undefined) updates.assignedTo = req.body.assignedTo;

    const [ticket] = await db
      .update(supportTicketsTable)
      .set(updates)
      .where(eq(supportTicketsTable.id, Number(req.params.id)))
      .returning();

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json(ticket);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/tickets/:id/messages", requireSuperAdmin, async (req: any, res) => {
  try {
    const admin = (req as any).superAdmin;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const [msg] = await db.insert(supportTicketMessagesTable).values({
      ticketId: Number(req.params.id),
      senderType: "admin",
      senderName: `${admin.name} (BHOS Support)`,
      senderEmail: admin.email,
      message,
    }).returning();

    await db.update(supportTicketsTable)
      .set({ updatedAt: new Date(), status: "in_progress" })
      .where(eq(supportTicketsTable.id, Number(req.params.id)));

    res.status(201).json(msg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
