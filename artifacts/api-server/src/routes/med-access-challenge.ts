import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, staffTable, medAccessChallengesTable } from "@workspace/db";
import crypto from "crypto";

const router: IRouter = Router();

const CHALLENGE_EXPIRY_SECONDS = 120;

const approvedTokens = new Map<string, { staffId: number; expiresAt: number }>();

function resolveCallerEmail(req: any): string | undefined {
  if (process.env.NODE_ENV !== "production" && req.headers["x-test-user-email"]) {
    return req.headers["x-test-user-email"] as string;
  }
  return req.auth?.sessionClaims?.email || req.auth?.claims?.email;
}

router.post("/med-access/challenge", async (req, res): Promise<void> => {
  try {
    const email = resolveCallerEmail(req);
    if (!email) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.email, email));
    if (!staff) { res.status(404).json({ error: "Staff not found" }); return; }

    const { patientName, medicationName } = req.body || {};

    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_SECONDS * 1000);

    const responseSecret = crypto.randomBytes(32).toString("hex");

    const [challenge] = await db.insert(medAccessChallengesTable).values({
      staffId: staff.id,
      challengeType: "medication_admin",
      patientName: patientName || null,
      medicationName: medicationName || null,
      responseSecret,
      expiresAt,
    }).returning();

    const tokens = await db.execute(sql`
      SELECT expo_push_token FROM push_tokens
      WHERE staff_id = ${staff.id} AND is_active = true
    `);

    if (tokens.rows.length > 0) {
      const messages = tokens.rows.map((row: any) => ({
        to: row.expo_push_token,
        sound: "default",
        title: "Medication Access Approval",
        body: patientName
          ? `Approve medication access for ${patientName}${medicationName ? ` — ${medicationName}` : ""}`
          : "Approve medication access request from shared workstation",
        data: {
          type: "med_access_challenge",
          challengeId: challenge.id,
          responseSecret: challenge.responseSecret,
          patientName,
          medicationName,
        },
        priority: "high" as const,
        channelId: "urgent",
      }));

      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messages),
        });
      } catch {}
    }

    res.status(201).json({
      challengeId: challenge.id,
      status: "pending",
      expiresAt: challenge.expiresAt,
      pushSent: tokens.rows.length > 0,
      deviceCount: tokens.rows.length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/med-access/challenge/:id", async (req, res): Promise<void> => {
  try {
    const email = resolveCallerEmail(req);
    if (!email) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.email, email));
    if (!staff) { res.status(403).json({ error: "Forbidden" }); return; }

    const challengeId = parseInt(req.params.id);
    if (isNaN(challengeId)) { res.status(400).json({ error: "Invalid challenge ID" }); return; }

    const [challenge] = await db.select().from(medAccessChallengesTable)
      .where(and(
        eq(medAccessChallengesTable.id, challengeId),
        eq(medAccessChallengesTable.staffId, staff.id)
      ));

    if (!challenge) { res.status(404).json({ error: "Challenge not found" }); return; }

    let status = challenge.status;
    if (status === "pending" && new Date(challenge.expiresAt) < new Date()) {
      status = "expired";
      await db.update(medAccessChallengesTable)
        .set({ status: "expired" })
        .where(eq(medAccessChallengesTable.id, challengeId));
    }

    const response: any = {
      id: challenge.id,
      status,
      expiresAt: challenge.expiresAt,
      respondedAt: challenge.respondedAt,
    };

    if (status === "approved") {
      if (challenge.approvalToken) {
        const entry = approvedTokens.get(challenge.approvalToken);
        if (entry && entry.expiresAt > Date.now()) {
          response.pinVerificationToken = challenge.approvalToken;
        }
      } else {
        const token = crypto.randomBytes(32).toString("hex");
        const tokenExpiry = Date.now() + 5 * 60 * 1000;
        approvedTokens.set(token, { staffId: challenge.staffId, expiresAt: tokenExpiry });
        setTimeout(() => approvedTokens.delete(token), 5 * 60 * 1000);

        await db.update(medAccessChallengesTable)
          .set({ approvalToken: token })
          .where(eq(medAccessChallengesTable.id, challengeId));

        response.pinVerificationToken = token;
      }
    }

    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/med-access/verify-token/:token", async (req, res): Promise<void> => {
  const entry = approvedTokens.get(req.params.token);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(401).json({ valid: false });
    return;
  }
  res.json({ valid: true, staffId: entry.staffId });
});

export { approvedTokens };
export default router;
