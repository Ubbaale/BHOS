import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, deviceEnrollmentsTable, staffTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/devices/register", requireAuth, async (req: any, res) => {
  try {
    const { deviceId, deviceName, platform, osVersion, appVersion } = req.body;
    if (!deviceId || !deviceName || !platform) {
      return res.status(400).json({ error: "deviceId, deviceName, and platform are required" });
    }

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, req.userId)).limit(1);
    if (!staff) {
      return res.status(404).json({ error: "Staff record not found" });
    }

    const [existing] = await db.select().from(deviceEnrollmentsTable)
      .where(and(
        eq(deviceEnrollmentsTable.staffId, staff.id),
        eq(deviceEnrollmentsTable.deviceId, deviceId),
      ));

    if (existing) {
      if (existing.status === "blocked") {
        return res.json({ enrollment: existing, message: "This device has been blocked by an administrator." });
      }

      await db.update(deviceEnrollmentsTable).set({
        deviceName,
        platform,
        osVersion: osVersion || existing.osVersion,
        appVersion: appVersion || existing.appVersion,
        lastActiveAt: new Date(),
      }).where(eq(deviceEnrollmentsTable.id, existing.id));

      const [updated] = await db.select().from(deviceEnrollmentsTable)
        .where(eq(deviceEnrollmentsTable.id, existing.id));
      return res.json({ enrollment: updated, message: existing.status === "approved" ? "Device already approved" : "Device registration pending admin approval" });
    }

    const [enrollment] = await db.insert(deviceEnrollmentsTable).values({
      staffId: staff.id,
      deviceId,
      deviceName,
      platform,
      osVersion,
      appVersion,
      status: "pending",
    }).returning();

    res.status(201).json({
      enrollment,
      message: "Device registered. Awaiting admin approval before full access is granted.",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/devices/my-status", requireAuth, async (req: any, res) => {
  try {
    const deviceId = req.headers["x-device-id"];
    if (!deviceId) {
      return res.json({ enrolled: false, status: "unknown", message: "No device ID provided" });
    }

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, req.userId)).limit(1);
    if (!staff) {
      return res.json({ enrolled: false, status: "no_staff", message: "No staff record found" });
    }

    const [enrollment] = await db.select().from(deviceEnrollmentsTable)
      .where(and(
        eq(deviceEnrollmentsTable.staffId, staff.id),
        eq(deviceEnrollmentsTable.deviceId, deviceId as string),
      ));

    if (!enrollment) {
      return res.json({ enrolled: false, status: "not_registered", message: "Device not registered" });
    }

    if (enrollment.status === "approved") {
      await db.update(deviceEnrollmentsTable).set({ lastActiveAt: new Date() })
        .where(eq(deviceEnrollmentsTable.id, enrollment.id));
    }

    res.json({
      enrolled: true,
      status: enrollment.status,
      enrollment,
      message: enrollment.status === "approved"
        ? "Device approved"
        : enrollment.status === "pending"
          ? "Awaiting admin approval"
          : enrollment.status === "revoked"
            ? "Device access has been revoked. Contact your administrator."
            : "Device has been blocked. Contact your administrator.",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function resolveCallerOrg(userId: string) {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, userId)).limit(1);
  return staff;
}

router.get("/devices", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const caller = await resolveCallerOrg(req.userId);
    if (!caller?.orgId) return res.status(403).json({ error: "No organization found" });

    const enrollments = await db.select({
      id: deviceEnrollmentsTable.id,
      staffId: deviceEnrollmentsTable.staffId,
      deviceId: deviceEnrollmentsTable.deviceId,
      deviceName: deviceEnrollmentsTable.deviceName,
      platform: deviceEnrollmentsTable.platform,
      osVersion: deviceEnrollmentsTable.osVersion,
      appVersion: deviceEnrollmentsTable.appVersion,
      status: deviceEnrollmentsTable.status,
      enrolledAt: deviceEnrollmentsTable.enrolledAt,
      approvedAt: deviceEnrollmentsTable.approvedAt,
      approvedBy: deviceEnrollmentsTable.approvedBy,
      revokedAt: deviceEnrollmentsTable.revokedAt,
      lastActiveAt: deviceEnrollmentsTable.lastActiveAt,
      notes: deviceEnrollmentsTable.notes,
      staffFirstName: staffTable.firstName,
      staffLastName: staffTable.lastName,
      staffEmail: staffTable.email,
      staffRole: staffTable.role,
    })
      .from(deviceEnrollmentsTable)
      .leftJoin(staffTable, eq(deviceEnrollmentsTable.staffId, staffTable.id))
      .where(eq(staffTable.orgId, caller.orgId))
      .orderBy(desc(deviceEnrollmentsTable.enrolledAt));

    res.json(enrollments);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function verifyEnrollmentOrgAccess(userId: string, enrollmentId: number) {
  const caller = await resolveCallerOrg(userId);
  if (!caller?.orgId) return null;

  const [enrollment] = await db.select({
    id: deviceEnrollmentsTable.id,
    staffOrgId: staffTable.orgId,
  })
    .from(deviceEnrollmentsTable)
    .leftJoin(staffTable, eq(deviceEnrollmentsTable.staffId, staffTable.id))
    .where(and(eq(deviceEnrollmentsTable.id, enrollmentId), eq(staffTable.orgId, caller.orgId)));

  return enrollment ? caller : null;
}

router.put("/devices/:id/approve", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid device ID" });

    const caller = await verifyEnrollmentOrgAccess(req.userId, id);
    if (!caller) return res.status(403).json({ error: "Access denied" });

    const [updated] = await db.update(deviceEnrollmentsTable).set({
      status: "approved",
      approvedAt: new Date(),
      approvedBy: caller.id,
      notes: req.body.notes || null,
    }).where(eq(deviceEnrollmentsTable.id, id)).returning();

    if (!updated) return res.status(404).json({ error: "Device enrollment not found" });
    res.json({ enrollment: updated, message: "Device approved successfully" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/devices/:id/revoke", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid device ID" });

    const caller = await verifyEnrollmentOrgAccess(req.userId, id);
    if (!caller) return res.status(403).json({ error: "Access denied" });

    const [updated] = await db.update(deviceEnrollmentsTable).set({
      status: "revoked",
      revokedAt: new Date(),
      notes: req.body.notes || null,
    }).where(eq(deviceEnrollmentsTable.id, id)).returning();

    if (!updated) return res.status(404).json({ error: "Device enrollment not found" });
    res.json({ enrollment: updated, message: "Device access revoked" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/devices/:id/block", requireAuth, requireRole("admin"), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid device ID" });

    const caller = await verifyEnrollmentOrgAccess(req.userId, id);
    if (!caller) return res.status(403).json({ error: "Access denied" });

    const [updated] = await db.update(deviceEnrollmentsTable).set({
      status: "blocked",
      revokedAt: new Date(),
      notes: req.body.notes || null,
    }).where(eq(deviceEnrollmentsTable.id, id)).returning();

    if (!updated) return res.status(404).json({ error: "Device enrollment not found" });
    res.json({ enrollment: updated, message: "Device blocked" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/devices/:id", requireAuth, requireRole("admin"), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid device ID" });

    const caller = await verifyEnrollmentOrgAccess(req.userId, id);
    if (!caller) return res.status(403).json({ error: "Access denied" });

    const [deleted] = await db.delete(deviceEnrollmentsTable)
      .where(eq(deviceEnrollmentsTable.id, id)).returning();

    if (!deleted) return res.status(404).json({ error: "Device enrollment not found" });
    res.json({ message: "Device enrollment deleted" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
