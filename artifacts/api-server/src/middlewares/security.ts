import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, phiAccessLogsTable, activeSessionsTable, securitySettingsTable, homesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
}

function getLocationFromHeaders(req: Request) {
  const lat = req.headers["x-client-latitude"] as string;
  const lng = req.headers["x-client-longitude"] as string;
  return {
    latitude: lat ? parseFloat(lat) : null,
    longitude: lng ? parseFloat(lng) : null,
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let cachedSettings: any = null;
let settingsCachedAt = 0;

async function getSecuritySettings() {
  if (cachedSettings && Date.now() - settingsCachedAt < 60000) return cachedSettings;
  const [settings] = await db.select().from(securitySettingsTable).where(eq(securitySettingsTable.id, 1));
  cachedSettings = settings;
  settingsCachedAt = Date.now();
  return settings;
}

export function clearSettingsCache() {
  cachedSettings = null;
  settingsCachedAt = 0;
}

export async function checkGeofence(
  latitude: number,
  longitude: number,
  radiusOverride?: number
): Promise<{ allowed: boolean; nearestHome?: string; distance?: number }> {
  const settings = await getSecuritySettings();
  if (!settings?.geofenceEnabled) return { allowed: true };

  const homes = await db
    .select({
      name: homesTable.name,
      latitude: homesTable.latitude,
      longitude: homesTable.longitude,
      radius: homesTable.geofenceRadiusMeters,
    })
    .from(homesTable)
    .where(eq(homesTable.status, "active"));

  const radius = radiusOverride || settings.geofenceRadiusMeters;
  let nearestHome = "";
  let minDistance = Infinity;

  for (const home of homes) {
    if (!home.latitude || !home.longitude) continue;
    const dist = haversineDistance(latitude, longitude, parseFloat(home.latitude), parseFloat(home.longitude));
    const effectiveRadius = home.radius || radius;
    if (dist <= effectiveRadius) {
      return { allowed: true, nearestHome: home.name, distance: Math.round(dist) };
    }
    if (dist < minDistance) {
      minDistance = dist;
      nearestHome = home.name;
    }
  }

  return { allowed: false, nearestHome, distance: Math.round(minDistance) };
}

export const geofenceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const settings = await getSecuritySettings();
  if (!settings?.geofenceEnabled) return next();

  const { latitude, longitude } = getLocationFromHeaders(req);
  if (!latitude || !longitude) {
    return res.status(403).json({
      error: "Location required",
      code: "LOCATION_REQUIRED",
      message: "Your location is required to access patient data. Please enable location services.",
    });
  }

  const result = await checkGeofence(latitude, longitude);
  if (!result.allowed) {
    await db.insert(phiAccessLogsTable).values({
      clerkUserId: req.userId || "unknown",
      action: "GEOFENCE_BLOCKED",
      resourceType: "system",
      details: `Blocked access from ${result.distance}m away from nearest facility (${result.nearestHome})`,
      ipAddress: getClientIp(req),
      latitude: latitude.toFixed(7),
      longitude: longitude.toFixed(7),
      geofenceStatus: "outside",
    });

    return res.status(403).json({
      error: "Access denied",
      code: "OUTSIDE_GEOFENCE",
      message: `You must be within an approved facility to access patient data. Nearest facility: ${result.nearestHome} (${result.distance}m away).`,
    });
  }

  next();
};

export const logPhiAccess = (resourceType: string, action: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const { latitude, longitude } = getLocationFromHeaders(req);
    const resourceId = req.params.id || req.params.patientId || undefined;

    try {
      await db.insert(phiAccessLogsTable).values({
        clerkUserId: req.userId || "unknown",
        userName: (req as any).userName || undefined,
        action,
        resourceType,
        resourceId: resourceId || undefined,
        ipAddress: getClientIp(req),
        latitude: latitude?.toFixed(7) ?? null,
        longitude: longitude?.toFixed(7) ?? null,
        userAgent: req.headers["user-agent"] || undefined,
        geofenceStatus: latitude && longitude ? "verified" : "no_location",
      });
    } catch (e) {
      console.error("PHI access log error:", e);
    }
    next();
  };
};

export const trackSession = async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.userId) return next();

  const auth = getAuth(req);
  const sessionId = auth?.sessionId;
  const { latitude, longitude } = getLocationFromHeaders(req);

  try {
    if (sessionId) {
      const [existing] = await db
        .select()
        .from(activeSessionsTable)
        .where(
          and(
            eq(activeSessionsTable.clerkSessionId, sessionId),
            eq(activeSessionsTable.isRevoked, false)
          )
        );

      if (existing) {
        await db
          .update(activeSessionsTable)
          .set({
            lastActivity: new Date(),
            ipAddress: getClientIp(req),
            latitude: latitude?.toFixed(7) ?? existing.latitude,
            longitude: longitude?.toFixed(7) ?? existing.longitude,
          })
          .where(eq(activeSessionsTable.id, existing.id));
      } else {
        await db.insert(activeSessionsTable).values({
          clerkUserId: req.userId,
          clerkSessionId: sessionId,
          userName: (req as any).userName,
          deviceInfo: req.headers["user-agent"] || "unknown",
          ipAddress: getClientIp(req),
          latitude: latitude?.toFixed(7) ?? null,
          longitude: longitude?.toFixed(7) ?? null,
          isRevoked: false,
        });
      }
    }
  } catch (e) {
    console.error("Session tracking error:", e);
  }

  next();
};

export const enforceIpWhitelist = async (req: Request, res: Response, next: NextFunction) => {
  const settings = await getSecuritySettings();
  if (!settings?.ipWhitelistEnabled || !settings.allowedIps?.length) return next();

  const clientIp = getClientIp(req);
  if (!settings.allowedIps.includes(clientIp)) {
    await db.insert(phiAccessLogsTable).values({
      clerkUserId: req.userId || "unknown",
      action: "IP_BLOCKED",
      resourceType: "system",
      details: `Blocked access from IP ${clientIp}`,
      ipAddress: clientIp,
      geofenceStatus: "unknown",
    });

    return res.status(403).json({
      error: "Access denied",
      code: "IP_NOT_ALLOWED",
      message: "Access is restricted to approved network locations.",
    });
  }
  next();
};

export const enforceSessionTimeout = async (req: Request, res: Response, next: NextFunction) => {
  const settings = await getSecuritySettings();
  if (!settings || !req.userId) return next();

  const auth = getAuth(req);
  const sessionId = auth?.sessionId;
  if (!sessionId) return next();

  const [session] = await db
    .select()
    .from(activeSessionsTable)
    .where(
      and(
        eq(activeSessionsTable.clerkSessionId, sessionId),
        eq(activeSessionsTable.isRevoked, false)
      )
    );

  if (session) {
    const idleMs = Date.now() - new Date(session.lastActivity).getTime();
    const timeoutMs = settings.sessionTimeoutMinutes * 60 * 1000;
    if (idleMs > timeoutMs) {
      await db
        .update(activeSessionsTable)
        .set({ isRevoked: true })
        .where(eq(activeSessionsTable.id, session.id));

      return res.status(401).json({
        error: "Session expired",
        code: "SESSION_TIMEOUT",
        message: `Your session has expired after ${settings.sessionTimeoutMinutes} minutes of inactivity.`,
        timeoutMinutes: settings.sessionTimeoutMinutes,
      });
    }
  }

  next();
};

export { getSecuritySettings };
