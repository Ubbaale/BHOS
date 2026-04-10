import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, staffTable, medPassPinsTable, pinAttemptLogsTable } from "@workspace/db";
import crypto from "crypto";

const router: IRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const PIN_TOKEN_EXPIRY_MS = 5 * 60 * 1000;

function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

const pinVerificationTokens = new Map<string, { staffId: number; expiresAt: number }>();

function createPinToken(staffId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  pinVerificationTokens.set(token, {
    staffId,
    expiresAt: Date.now() + PIN_TOKEN_EXPIRY_MS,
  });
  return token;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pinVerificationTokens) {
    if (val.expiresAt < now) pinVerificationTokens.delete(key);
  }
}, 60_000);

async function resolveCallerStaff(req: any) {
  let email: string | undefined;
  if (process.env.NODE_ENV !== "production" && req.headers["x-test-user-email"]) {
    email = req.headers["x-test-user-email"] as string;
  } else {
    email = req.auth?.sessionClaims?.email || req.auth?.claims?.email;
  }
  if (!email) return null;
  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.email, email));
  return staff || null;
}

router.get("/staff/med-pin/status", async (req, res): Promise<void> => {
  const staff = await resolveCallerStaff(req);
  if (!staff) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [pin] = await db
    .select({ id: medPassPinsTable.id, updatedAt: medPassPinsTable.updatedAt })
    .from(medPassPinsTable)
    .where(eq(medPassPinsTable.staffId, staff.id));

  res.json({
    hasPinSet: !!pin,
    lastUpdated: pin?.updatedAt || null,
    staffId: staff.id,
    staffName: `${staff.firstName} ${staff.lastName}`,
  });
});

router.post("/staff/med-pin", async (req, res): Promise<void> => {
  const staff = await resolveCallerStaff(req);
  if (!staff) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { pin, currentPin } = req.body;

  if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    res.status(400).json({ error: "PIN must be 4-6 digits" });
    return;
  }

  const [existing] = await db
    .select()
    .from(medPassPinsTable)
    .where(eq(medPassPinsTable.staffId, staff.id));

  if (existing) {
    if (!currentPin) {
      res.status(400).json({ error: "Current PIN required to update" });
      return;
    }
    const currentHash = hashPin(currentPin, existing.salt);
    if (currentHash !== existing.hashedPin) {
      res.status(403).json({ error: "Current PIN is incorrect" });
      return;
    }
  }

  const salt = generateSalt();
  const hashedPin = hashPin(pin, salt);

  if (existing) {
    await db
      .update(medPassPinsTable)
      .set({ hashedPin, salt, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(medPassPinsTable.staffId, staff.id));
  } else {
    await db.insert(medPassPinsTable).values({
      staffId: staff.id,
      hashedPin,
      salt,
    });
  }

  res.json({ success: true, message: existing ? "PIN updated" : "PIN created" });
});

router.post("/staff/med-pin/verify", async (req, res): Promise<void> => {
  const staff = await resolveCallerStaff(req);
  if (!staff) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { pin } = req.body;

  if (!pin || typeof pin !== "string") {
    res.status(400).json({ error: "PIN required" });
    return;
  }

  const [pinRecord] = await db
    .select()
    .from(medPassPinsTable)
    .where(eq(medPassPinsTable.staffId, staff.id));

  if (!pinRecord) {
    res.status(404).json({ error: "No PIN set. Please set up your med-pass PIN first." });
    return;
  }

  if (pinRecord.lockedUntil && new Date(pinRecord.lockedUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(pinRecord.lockedUntil).getTime() - Date.now()) / 60000);
    await db.insert(pinAttemptLogsTable).values({
      staffId: staff.id,
      success: false,
      context: "med_administration_locked",
      ipAddress: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
    });
    res.status(423).json({
      error: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      lockedUntil: pinRecord.lockedUntil,
    });
    return;
  }

  const attemptHash = hashPin(pin, pinRecord.salt);

  if (attemptHash !== pinRecord.hashedPin) {
    const [updated] = await db
      .update(medPassPinsTable)
      .set({
        failedAttempts: sql`${medPassPinsTable.failedAttempts} + 1`,
        lockedUntil: sql`CASE WHEN ${medPassPinsTable.failedAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS} THEN NOW() + INTERVAL '${sql.raw(String(LOCKOUT_DURATION_MS / 60000))} minutes' ELSE ${medPassPinsTable.lockedUntil} END`,
      })
      .where(eq(medPassPinsTable.staffId, staff.id))
      .returning({ failedAttempts: medPassPinsTable.failedAttempts, lockedUntil: medPassPinsTable.lockedUntil });

    await db.insert(pinAttemptLogsTable).values({
      staffId: staff.id,
      success: false,
      context: "med_administration",
      ipAddress: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
    });

    const newFailedCount = updated?.failedAttempts ?? (pinRecord.failedAttempts + 1);
    const attemptsRemaining = MAX_FAILED_ATTEMPTS - newFailedCount;
    if (attemptsRemaining <= 0) {
      res.status(423).json({
        error: "Too many failed attempts. Account locked for 15 minutes.",
        lockedUntil: updated?.lockedUntil,
      });
    } else {
      res.status(403).json({
        error: `Incorrect PIN. ${attemptsRemaining} attempt(s) remaining.`,
        attemptsRemaining,
      });
    }
    return;
  }

  await db
    .update(medPassPinsTable)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(medPassPinsTable.staffId, staff.id));

  await db.insert(pinAttemptLogsTable).values({
    staffId: staff.id,
    success: true,
    context: "med_administration",
    ipAddress: req.ip || null,
    userAgent: req.headers["user-agent"] || null,
  });

  const token = createPinToken(staff.id);

  res.json({
    success: true,
    pinVerificationToken: token,
    expiresIn: PIN_TOKEN_EXPIRY_MS / 1000,
  });
});

router.get("/staff/med-pin/attempts", async (req, res): Promise<void> => {
  const staff = await resolveCallerStaff(req);
  if (!staff) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (staff.role !== "admin" && staff.role !== "manager") {
    res.status(403).json({ error: "Only admins and managers can view PIN attempt logs" });
    return;
  }

  const staffId = req.query.staffId ? Number(req.query.staffId) : undefined;

  let query = db
    .select({
      id: pinAttemptLogsTable.id,
      staffId: pinAttemptLogsTable.staffId,
      staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
      success: pinAttemptLogsTable.success,
      context: pinAttemptLogsTable.context,
      ipAddress: pinAttemptLogsTable.ipAddress,
      createdAt: pinAttemptLogsTable.createdAt,
    })
    .from(pinAttemptLogsTable)
    .leftJoin(staffTable, eq(pinAttemptLogsTable.staffId, staffTable.id))
    .orderBy(desc(pinAttemptLogsTable.createdAt))
    .$dynamic();

  if (staffId) {
    query = query.where(eq(pinAttemptLogsTable.staffId, staffId));
  }

  const attempts = await query;
  res.json(attempts);
});

export { pinVerificationTokens };
export default router;
