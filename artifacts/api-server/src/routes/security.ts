import { Router } from "express";
import {
  db,
  phiAccessLogsTable,
  activeSessionsTable,
  securitySettingsTable,
  homesTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte, sql, like, or } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { checkGeofence, clearSettingsCache, getSecuritySettings } from "../middlewares/security";

const router = Router();

router.get("/security/settings", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const [settings] = await db.select().from(securitySettingsTable).where(eq(securitySettingsTable.id, 1));
    res.json(settings);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/security/settings", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const {
      sessionTimeoutMinutes,
      geofenceEnabled,
      geofenceRadiusMeters,
      biometricRequired,
      biometricForControlledSubstances,
      requireDevicePasscode,
      ipWhitelistEnabled,
      allowedIps,
      maxFailedAttempts,
      lockoutDurationMinutes,
      auditRetentionDays,
    } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (sessionTimeoutMinutes !== undefined) updates.sessionTimeoutMinutes = sessionTimeoutMinutes;
    if (geofenceEnabled !== undefined) updates.geofenceEnabled = geofenceEnabled;
    if (geofenceRadiusMeters !== undefined) updates.geofenceRadiusMeters = geofenceRadiusMeters;
    if (biometricRequired !== undefined) updates.biometricRequired = biometricRequired;
    if (biometricForControlledSubstances !== undefined) updates.biometricForControlledSubstances = biometricForControlledSubstances;
    if (requireDevicePasscode !== undefined) updates.requireDevicePasscode = requireDevicePasscode;
    if (ipWhitelistEnabled !== undefined) updates.ipWhitelistEnabled = ipWhitelistEnabled;
    if (allowedIps !== undefined) updates.allowedIps = allowedIps;
    if (maxFailedAttempts !== undefined) updates.maxFailedAttempts = maxFailedAttempts;
    if (lockoutDurationMinutes !== undefined) updates.lockoutDurationMinutes = lockoutDurationMinutes;
    if (auditRetentionDays !== undefined) updates.auditRetentionDays = auditRetentionDays;

    const [updated] = await db
      .update(securitySettingsTable)
      .set(updates)
      .where(eq(securitySettingsTable.id, 1))
      .returning();

    clearSettingsCache();
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/security/geofences", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const homes = await db
      .select({
        id: homesTable.id,
        name: homesTable.name,
        address: homesTable.address,
        city: homesTable.city,
        state: homesTable.state,
        latitude: homesTable.latitude,
        longitude: homesTable.longitude,
        geofenceRadiusMeters: homesTable.geofenceRadiusMeters,
        status: homesTable.status,
      })
      .from(homesTable)
      .orderBy(homesTable.name);

    res.json(homes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/security/geofences/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { latitude, longitude, geofenceRadiusMeters } = req.body;
    const updates: any = {};
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (geofenceRadiusMeters !== undefined) updates.geofenceRadiusMeters = geofenceRadiusMeters;

    const [updated] = await db
      .update(homesTable)
      .set(updates)
      .where(eq(homesTable.id, parseInt(req.params.id)))
      .returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/security/verify-location", requireAuth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    const result = await checkGeofence(latitude, longitude);
    const settings = await getSecuritySettings();

    res.json({
      allowed: result.allowed,
      geofenceEnabled: settings?.geofenceEnabled ?? false,
      nearestHome: result.nearestHome,
      distance: result.distance,
      message: result.allowed
        ? `Access granted. Near: ${result.nearestHome || "facility"}`
        : `Outside approved area. Nearest: ${result.nearestHome} (${result.distance}m)`,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/security/access-logs", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { userId, resourceType, action, from, to, limit: limitStr, offset: offsetStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const offset = parseInt(offsetStr as string) || 0;

    const conditions: any[] = [];
    if (userId) conditions.push(eq(phiAccessLogsTable.clerkUserId, userId as string));
    if (resourceType) conditions.push(eq(phiAccessLogsTable.resourceType, resourceType as string));
    if (action) conditions.push(eq(phiAccessLogsTable.action, action as string));
    if (from) conditions.push(gte(phiAccessLogsTable.createdAt, new Date(from as string)));
    if (to) conditions.push(lte(phiAccessLogsTable.createdAt, new Date(to as string)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countResult] = await Promise.all([
      db
        .select()
        .from(phiAccessLogsTable)
        .where(whereClause)
        .orderBy(desc(phiAccessLogsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(phiAccessLogsTable)
        .where(whereClause),
    ]);

    res.json({
      logs,
      total: countResult[0]?.count || 0,
      limit,
      offset,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/security/access-logs/stats", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalToday, totalWeek, blockedToday, topUsers] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(phiAccessLogsTable).where(gte(phiAccessLogsTable.createdAt, today)),
      db.select({ count: sql<number>`count(*)::int` }).from(phiAccessLogsTable).where(gte(phiAccessLogsTable.createdAt, weekAgo)),
      db.select({ count: sql<number>`count(*)::int` }).from(phiAccessLogsTable).where(
        and(
          gte(phiAccessLogsTable.createdAt, today),
          or(eq(phiAccessLogsTable.action, "GEOFENCE_BLOCKED"), eq(phiAccessLogsTable.action, "IP_BLOCKED"))
        )
      ),
      db.select({
        userId: phiAccessLogsTable.clerkUserId,
        userName: phiAccessLogsTable.userName,
        count: sql<number>`count(*)::int`,
      }).from(phiAccessLogsTable)
        .where(gte(phiAccessLogsTable.createdAt, today))
        .groupBy(phiAccessLogsTable.clerkUserId, phiAccessLogsTable.userName)
        .orderBy(desc(sql`count(*)`))
        .limit(10),
    ]);

    res.json({
      accessesToday: totalToday[0]?.count || 0,
      accessesThisWeek: totalWeek[0]?.count || 0,
      blockedToday: blockedToday[0]?.count || 0,
      topUsers,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/security/sessions", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const sessions = await db
      .select()
      .from(activeSessionsTable)
      .where(eq(activeSessionsTable.isRevoked, false))
      .orderBy(desc(activeSessionsTable.lastActivity));

    res.json(sessions);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/security/sessions/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const [revoked] = await db
      .update(activeSessionsTable)
      .set({ isRevoked: true })
      .where(eq(activeSessionsTable.id, parseInt(req.params.id)))
      .returning();

    if (!revoked) return res.status(404).json({ error: "Session not found" });

    await db.insert(phiAccessLogsTable).values({
      clerkUserId: req.userId!,
      action: "SESSION_REVOKED",
      resourceType: "session",
      resourceId: req.params.id,
      details: `Admin revoked session for user ${revoked.clerkUserId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || "unknown",
      geofenceStatus: "unknown",
    });

    res.json({ message: "Session revoked", session: revoked });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/security/sessions/revoke-all/:userId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const result = await db
      .update(activeSessionsTable)
      .set({ isRevoked: true })
      .where(
        and(
          eq(activeSessionsTable.clerkUserId, targetUserId),
          eq(activeSessionsTable.isRevoked, false)
        )
      )
      .returning();

    await db.insert(phiAccessLogsTable).values({
      clerkUserId: req.userId!,
      action: "ALL_SESSIONS_REVOKED",
      resourceType: "session",
      details: `Admin revoked all ${result.length} sessions for user ${targetUserId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || "unknown",
      geofenceStatus: "unknown",
    });

    res.json({ message: `Revoked ${result.length} sessions`, count: result.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
