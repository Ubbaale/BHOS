import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, medAccessChallengesTable } from "@workspace/db";
import crypto from "crypto";

const router: IRouter = Router();

router.post("/med-access/challenge/:id/respond", async (req, res): Promise<void> => {
  try {
    const challengeId = parseInt(req.params.id);
    const { action, responseSecret } = req.body;

    if (!action || !["approve", "deny"].includes(action)) {
      res.status(400).json({ error: "Action must be 'approve' or 'deny'" });
      return;
    }

    if (!responseSecret || typeof responseSecret !== "string") {
      res.status(401).json({ error: "Missing or invalid response secret" });
      return;
    }

    const [updated] = await db.update(medAccessChallengesTable)
      .set({
        status: action === "approve" ? "approved" : "denied",
        respondedAt: new Date(),
      })
      .where(and(
        eq(medAccessChallengesTable.id, challengeId),
        eq(medAccessChallengesTable.status, "pending"),
        eq(medAccessChallengesTable.responseSecret, responseSecret),
        sql`${medAccessChallengesTable.expiresAt} > NOW()`
      ))
      .returning();

    if (!updated) {
      res.status(400).json({ error: "Challenge not found, already responded, expired, or invalid secret" });
      return;
    }

    res.json({
      id: updated.id,
      status: updated.status,
      respondedAt: updated.respondedAt,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
