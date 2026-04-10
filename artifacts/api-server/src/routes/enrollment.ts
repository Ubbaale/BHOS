import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, staffTable, staffInvitationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/staff/invitation/validate", async (req, res): Promise<void> => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).json({ error: "Invitation token is required" });
      return;
    }

    const [invite] = await db
      .select()
      .from(staffInvitationsTable)
      .where(eq(staffInvitationsTable.token, token));

    if (!invite) {
      res.status(404).json({ error: "Invalid invitation link" });
      return;
    }

    if (invite.status !== "pending") {
      res.status(400).json({ error: "This invitation has already been used" });
      return;
    }

    if (new Date(invite.expiresAt) < new Date()) {
      res.status(400).json({ error: "This invitation has expired. Please ask your manager to send a new one." });
      return;
    }

    const [staff] = await db.select({
      firstName: staffTable.firstName,
      lastName: staffTable.lastName,
      email: staffTable.email,
      role: staffTable.role,
    }).from(staffTable).where(eq(staffTable.id, invite.staffId));

    res.json({
      valid: true,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : "Unknown",
      email: invite.email,
      role: staff?.role || "caregiver",
      expiresAt: invite.expiresAt,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/staff/invitation/accept", async (req, res): Promise<void> => {
  try {
    const { token, clerkUserId } = req.body;
    if (!token || !clerkUserId) {
      res.status(400).json({ error: "Token and clerkUserId are required" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(staffInvitationsTable)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(
          and(
            eq(staffInvitationsTable.token, token),
            eq(staffInvitationsTable.status, "pending"),
            sql`${staffInvitationsTable.expiresAt} > NOW()`
          )
        )
        .returning();

      if (!updated) return null;

      await tx.update(staffTable)
        .set({ clerkUserId, status: "active" })
        .where(eq(staffTable.id, updated.staffId));

      const [staff] = await tx.select({
        id: staffTable.id,
        firstName: staffTable.firstName,
        lastName: staffTable.lastName,
        email: staffTable.email,
        role: staffTable.role,
      }).from(staffTable).where(eq(staffTable.id, updated.staffId));

      return staff;
    });

    if (!result) {
      res.status(400).json({ error: "Invalid, expired, or already-used invitation" });
      return;
    }

    res.json({
      message: "Account activated successfully. Welcome to BHOS!",
      staff: result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
