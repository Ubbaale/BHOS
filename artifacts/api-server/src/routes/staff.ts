import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, staffTable, homesTable, staffInvitationsTable } from "@workspace/db";
import {
  CreateStaffBody,
  GetStaffMemberParams,
  GetStaffMemberResponse,
  UpdateStaffParams,
  UpdateStaffBody,
  UpdateStaffResponse,
  ListStaffResponse,
  ListStaffQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/staff", async (req, res): Promise<void> => {
  const queryParams = ListStaffQueryParams.safeParse(req.query);

  let query = db
    .select({
      id: staffTable.id,
      firstName: staffTable.firstName,
      lastName: staffTable.lastName,
      email: staffTable.email,
      phone: staffTable.phone,
      role: staffTable.role,
      homeId: staffTable.homeId,
      homeName: homesTable.name,
      status: staffTable.status,
      employeeType: staffTable.employeeType,
      agencyName: staffTable.agencyName,
      contractEndDate: staffTable.contractEndDate,
      hourlyRate: sql<number | null>`${staffTable.hourlyRate}::float`,
      hireDate: staffTable.hireDate,
      createdAt: staffTable.createdAt,
    })
    .from(staffTable)
    .leftJoin(homesTable, eq(staffTable.homeId, homesTable.id))
    .orderBy(staffTable.lastName)
    .$dynamic();

  if (queryParams.success && queryParams.data.homeId) {
    query = query.where(eq(staffTable.homeId, queryParams.data.homeId));
  }

  const staff = await query;
  res.json(ListStaffResponse.parse(staff));
});

router.post("/staff", async (req, res): Promise<void> => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [member] = await db.insert(staffTable).values(parsed.data).returning();

  const [result] = await db
    .select({
      id: staffTable.id,
      firstName: staffTable.firstName,
      lastName: staffTable.lastName,
      email: staffTable.email,
      phone: staffTable.phone,
      role: staffTable.role,
      homeId: staffTable.homeId,
      homeName: homesTable.name,
      status: staffTable.status,
      employeeType: staffTable.employeeType,
      agencyName: staffTable.agencyName,
      contractEndDate: staffTable.contractEndDate,
      hourlyRate: sql<number | null>`${staffTable.hourlyRate}::float`,
      hireDate: staffTable.hireDate,
      createdAt: staffTable.createdAt,
    })
    .from(staffTable)
    .leftJoin(homesTable, eq(staffTable.homeId, homesTable.id))
    .where(eq(staffTable.id, member.id));

  res.status(201).json(GetStaffMemberResponse.parse(result));
});

const INVITE_EXPIRY_DAYS = 1;

async function resolveCallerStaff(req: any) {
  let email: string | undefined;
  if (process.env.NODE_ENV !== "production" && req.headers["x-test-user-email"]) {
    email = req.headers["x-test-user-email"] as string;
  } else {
    email = req.auth?.sessionClaims?.email || req.auth?.claims?.email;
  }
  if (!email) return null;
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.email, email));
  return staff || null;
}

router.get("/staff/invitations", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCallerStaff(req);
    if (!caller || (caller.role !== "admin" && caller.role !== "manager")) {
      res.status(403).json({ error: "Only admins and managers can view invitations" });
      return;
    }

    const invitations = await db
      .select({
        id: staffInvitationsTable.id,
        staffId: staffInvitationsTable.staffId,
        staffName: sql<string>`concat(s.first_name, ' ', s.last_name)`,
        email: staffInvitationsTable.email,
        status: staffInvitationsTable.status,
        token: staffInvitationsTable.token,
        expiresAt: staffInvitationsTable.expiresAt,
        acceptedAt: staffInvitationsTable.acceptedAt,
        invitedByName: sql<string>`concat(inv.first_name, ' ', inv.last_name)`,
        createdAt: staffInvitationsTable.createdAt,
      })
      .from(staffInvitationsTable)
      .leftJoin(sql`staff s`, sql`s.id = ${staffInvitationsTable.staffId}`)
      .leftJoin(sql`staff inv`, sql`inv.id = ${staffInvitationsTable.invitedBy}`)
      .where(sql`s.org_id = ${caller.orgId}`)
      .orderBy(staffInvitationsTable.createdAt);

    res.json(invitations);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/staff/invitation/:id", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCallerStaff(req);
    if (!caller || (caller.role !== "admin" && caller.role !== "manager")) {
      res.status(403).json({ error: "Only admins and managers can revoke invitations" });
      return;
    }

    const inviteId = parseInt(req.params.id);
    const result = await db.update(staffInvitationsTable)
      .set({ status: "revoked" })
      .where(and(
        eq(staffInvitationsTable.id, inviteId),
        sql`${staffInvitationsTable.staffId} IN (SELECT id FROM staff WHERE org_id = ${caller.orgId})`
      ))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }

    res.json({ message: "Invitation revoked" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/staff/:id/invite", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCallerStaff(req);
    if (!caller || (caller.role !== "admin" && caller.role !== "manager")) {
      res.status(403).json({ error: "Only admins and managers can send invitations" });
      return;
    }

    const staffId = parseInt(req.params.id);
    if (isNaN(staffId)) {
      res.status(400).json({ error: "Invalid staff ID" });
      return;
    }

    const [targetStaff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
    if (!targetStaff) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    if (targetStaff.orgId !== caller.orgId) {
      res.status(403).json({ error: "Cannot invite staff from another organization" });
      return;
    }

    if (targetStaff.clerkUserId) {
      res.status(400).json({ error: "Staff member already has an account set up" });
      return;
    }

    const [existingInvite] = await db
      .select()
      .from(staffInvitationsTable)
      .where(and(
        eq(staffInvitationsTable.staffId, staffId),
        eq(staffInvitationsTable.status, "pending")
      ));

    if (existingInvite && new Date(existingInvite.expiresAt) > new Date()) {
      res.json({
        message: "An active invitation already exists for this staff member",
        invitation: {
          id: existingInvite.id,
          token: existingInvite.token,
          email: existingInvite.email,
          expiresAt: existingInvite.expiresAt,
          enrollmentLink: `bhos://enroll?token=${existingInvite.token}`,
        },
      });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const [invite] = await db.insert(staffInvitationsTable).values({
      staffId,
      token,
      email: targetStaff.email,
      expiresAt,
      invitedBy: caller.id,
    }).returning();

    res.status(201).json({
      message: `Enrollment invitation created for ${targetStaff.firstName} ${targetStaff.lastName}`,
      invitation: {
        id: invite.id,
        token: invite.token,
        email: invite.email,
        expiresAt: invite.expiresAt,
        enrollmentLink: `bhos://enroll?token=${invite.token}`,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/staff/me", requireAuth, async (req: any, res): Promise<void> => {
  try {
    const [staff] = await db
      .select({
        id: staffTable.id,
        firstName: staffTable.firstName,
        lastName: staffTable.lastName,
        email: staffTable.email,
        role: staffTable.role,
        orgId: staffTable.orgId,
      })
      .from(staffTable)
      .where(eq(staffTable.clerkUserId, req.userId))
      .limit(1);

    if (!staff) {
      res.status(404).json({ error: "Staff record not found" });
      return;
    }
    res.json(staff);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/staff/:id", async (req, res): Promise<void> => {
  const params = GetStaffMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [member] = await db
    .select({
      id: staffTable.id,
      firstName: staffTable.firstName,
      lastName: staffTable.lastName,
      email: staffTable.email,
      phone: staffTable.phone,
      role: staffTable.role,
      homeId: staffTable.homeId,
      homeName: homesTable.name,
      status: staffTable.status,
      employeeType: staffTable.employeeType,
      agencyName: staffTable.agencyName,
      contractEndDate: staffTable.contractEndDate,
      hourlyRate: sql<number | null>`${staffTable.hourlyRate}::float`,
      hireDate: staffTable.hireDate,
      createdAt: staffTable.createdAt,
    })
    .from(staffTable)
    .leftJoin(homesTable, eq(staffTable.homeId, homesTable.id))
    .where(eq(staffTable.id, params.data.id));

  if (!member) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }

  res.json(GetStaffMemberResponse.parse(member));
});

router.patch("/staff/:id", async (req, res): Promise<void> => {
  const params = UpdateStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData = { ...parsed.data };
  if ('role' in updateData) {
    delete (updateData as any).role;
  }

  const [updated] = await db
    .update(staffTable)
    .set(updateData)
    .where(eq(staffTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }

  const [result] = await db
    .select({
      id: staffTable.id,
      firstName: staffTable.firstName,
      lastName: staffTable.lastName,
      email: staffTable.email,
      phone: staffTable.phone,
      role: staffTable.role,
      homeId: staffTable.homeId,
      homeName: homesTable.name,
      status: staffTable.status,
      employeeType: staffTable.employeeType,
      agencyName: staffTable.agencyName,
      contractEndDate: staffTable.contractEndDate,
      hourlyRate: sql<number | null>`${staffTable.hourlyRate}::float`,
      hireDate: staffTable.hireDate,
      createdAt: staffTable.createdAt,
    })
    .from(staffTable)
    .leftJoin(homesTable, eq(staffTable.homeId, homesTable.id))
    .where(eq(staffTable.id, updated.id));

  res.json(UpdateStaffResponse.parse(result));
});

router.put("/staff/:id/role", requireAuth, async (req: any, res): Promise<void> => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "Invalid staff ID" }); return; }

    const { role } = req.body;
    const validRoles = ["admin", "manager", "nurse", "caregiver", "supervisor", "direct_care"];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
      return;
    }

    const [caller] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, req.userId)).limit(1);
    if (!caller || caller.role !== "admin") {
      res.status(403).json({ error: "Only admins can change staff roles" });
      return;
    }

    const [target] = await db.select().from(staffTable).where(eq(staffTable.id, targetId)).limit(1);
    if (!target) { res.status(404).json({ error: "Staff member not found" }); return; }
    if (target.orgId !== caller.orgId) { res.status(403).json({ error: "Access denied" }); return; }
    if (target.id === caller.id) { res.status(400).json({ error: "Cannot change your own role. Use admin transfer instead." }); return; }

    const [updated] = await db.update(staffTable).set({ role }).where(eq(staffTable.id, targetId)).returning();
    res.json({ staff: updated, message: `Role updated to ${role}` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/staff/transfer-admin", requireAuth, async (req: any, res): Promise<void> => {
  try {
    const { targetStaffId } = req.body;
    if (!targetStaffId) { res.status(400).json({ error: "targetStaffId is required" }); return; }

    const newAdminId = parseInt(targetStaffId, 10);
    if (isNaN(newAdminId)) { res.status(400).json({ error: "Invalid staff ID" }); return; }

    const [caller] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, req.userId)).limit(1);
    if (!caller || caller.role !== "admin") {
      res.status(403).json({ error: "Only the current admin can transfer admin ownership" });
      return;
    }

    const [target] = await db.select().from(staffTable).where(eq(staffTable.id, newAdminId)).limit(1);
    if (!target) { res.status(404).json({ error: "Target staff member not found" }); return; }
    if (target.orgId !== caller.orgId) { res.status(403).json({ error: "Target must be in the same organization" }); return; }
    if (target.id === caller.id) { res.status(400).json({ error: "Cannot transfer admin to yourself" }); return; }

    await db.transaction(async (tx) => {
      await tx.update(staffTable).set({ role: "admin" }).where(eq(staffTable.id, newAdminId));
      await tx.update(staffTable).set({ role: "manager" }).where(eq(staffTable.id, caller.id));
    });

    res.json({
      message: `Admin ownership transferred to ${target.firstName} ${target.lastName}. Your role has been changed to manager.`,
      newAdmin: { id: target.id, name: `${target.firstName} ${target.lastName}` },
      previousAdmin: { id: caller.id, newRole: "manager" },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
