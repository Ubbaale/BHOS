import { Router } from "express";
import {
  db,
  shiftPostsTable,
  shiftSwapRequestsTable,
  staffAvailabilityTable,
  onboardingChecklistTable,
  onboardingProgressTable,
  overtimeAlertsTable,
  attendanceRecordsTable,
  staffTable,
  homesTable,
  shiftsTable,
  timePunchesTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte, sql, or, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";

const router = Router();

async function resolveStaffFromClerk(clerkUserId: string) {
  try {
    const user = await clerkClient.users.getUser(clerkUserId);
    const email = user.emailAddresses?.[0]?.emailAddress;
    if (!email) return null;
    const [staff] = await db.select().from(staffTable).where(eq(staffTable.email, email));
    return staff || null;
  } catch {
    return null;
  }
}

// ── SHIFT POSTS (Open Shifts / Bidding) ──

router.get("/shift-posts", requireAuth, async (req, res) => {
  try {
    const { status, homeId } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(shiftPostsTable.status, status as string));
    if (homeId) conditions.push(eq(shiftPostsTable.homeId, parseInt(homeId as string)));

    const posts = await db
      .select({
        id: shiftPostsTable.id,
        homeId: shiftPostsTable.homeId,
        homeName: homesTable.name,
        startTime: shiftPostsTable.startTime,
        endTime: shiftPostsTable.endTime,
        roleRequired: shiftPostsTable.roleRequired,
        description: shiftPostsTable.description,
        urgency: shiftPostsTable.urgency,
        status: shiftPostsTable.status,
        claimedBy: shiftPostsTable.claimedBy,
        claimedAt: shiftPostsTable.claimedAt,
        expiresAt: shiftPostsTable.expiresAt,
        createdAt: shiftPostsTable.createdAt,
      })
      .from(shiftPostsTable)
      .leftJoin(homesTable, eq(shiftPostsTable.homeId, homesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shiftPostsTable.createdAt));

    res.json(posts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/shift-posts", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { homeId, startTime, endTime, roleRequired, description, urgency, expiresAt } = req.body;

    if (!homeId || !startTime || !endTime) {
      return res.status(400).json({ error: "homeId, startTime, and endTime are required" });
    }

    const poster = await resolveStaffFromClerk(req.userId!);
    const postedById = poster?.id;
    if (!postedById) return res.status(400).json({ error: "Staff record not found for your account" });

    const [post] = await db.insert(shiftPostsTable).values({
      homeId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      roleRequired: roleRequired || "caregiver",
      description,
      urgency: urgency || "normal",
      postedBy: postedById,
      status: "open",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    res.status(201).json(post);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/shift-posts/:id/claim", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid shift post ID" });

    const claimer = await resolveStaffFromClerk(req.userId!);
    if (!claimer) return res.status(400).json({ error: "Staff record not found for your account" });

    const [post] = await db.select().from(shiftPostsTable).where(eq(shiftPostsTable.id, postId));
    if (!post) return res.status(404).json({ error: "Shift post not found" });
    if (post.status !== "open") return res.status(400).json({ error: "This shift is no longer available" });

    if (post.expiresAt && new Date(post.expiresAt) < new Date()) {
      await db.update(shiftPostsTable).set({ status: "expired" }).where(eq(shiftPostsTable.id, postId));
      return res.status(400).json({ error: "This shift posting has expired" });
    }

    const [updated] = await db
      .update(shiftPostsTable)
      .set({ status: "claimed", claimedBy: claimer.id, claimedAt: new Date() })
      .where(and(eq(shiftPostsTable.id, postId), eq(shiftPostsTable.status, "open")))
      .returning();

    if (!updated) return res.status(400).json({ error: "Shift was already claimed" });

    await db.insert(shiftsTable).values({
      staffId: claimer.id,
      homeId: updated.homeId,
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: "scheduled",
      notes: `Claimed from open shift post #${postId}`,
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/shift-posts/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { status, approvedBy } = req.body;
    const updates: any = {};
    if (status) updates.status = status;
    if (status === "approved") {
      updates.approvedAt = new Date();
    }

    const [updated] = await db
      .update(shiftPostsTable)
      .set(updates)
      .where(eq(shiftPostsTable.id, parseInt(req.params.id)))
      .returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── SHIFT SWAP REQUESTS ──

router.get("/shift-swaps", requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(shiftSwapRequestsTable.status, status as string));

    const swaps = await db
      .select()
      .from(shiftSwapRequestsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shiftSwapRequestsTable.createdAt));

    res.json(swaps);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/shift-swaps", requireAuth, async (req, res) => {
  try {
    const { requesterShiftId, responderId, responderShiftId, reason } = req.body;

    if (!requesterShiftId) return res.status(400).json({ error: "requesterShiftId is required" });

    const requester = await resolveStaffFromClerk(req.userId!);
    if (!requester) return res.status(400).json({ error: "Staff record not found for your account" });

    const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, requesterShiftId));
    if (!shift || shift.staffId !== requester.id) {
      return res.status(403).json({ error: "You can only request swaps for your own shifts" });
    }

    const [swap] = await db.insert(shiftSwapRequestsTable).values({
      requesterId: requester.id,
      requesterShiftId,
      responderId,
      responderShiftId,
      reason,
      status: "pending",
    }).returning();

    res.status(201).json(swap);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/shift-swaps/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { status } = req.body;
    const swapId = parseInt(req.params.id);

    const [swap] = await db.select().from(shiftSwapRequestsTable).where(eq(shiftSwapRequestsTable.id, swapId));
    if (!swap) return res.status(404).json({ error: "Swap request not found" });

    const updates: any = { status };
    if (status === "approved") {
      updates.approvedAt = new Date();

      if (swap.responderId && swap.responderShiftId) {
        await db.update(shiftsTable).set({ staffId: swap.responderId }).where(eq(shiftsTable.id, swap.requesterShiftId));
        await db.update(shiftsTable).set({ staffId: swap.requesterId }).where(eq(shiftsTable.id, swap.responderShiftId));
      }
    }

    const [updated] = await db
      .update(shiftSwapRequestsTable)
      .set(updates)
      .where(eq(shiftSwapRequestsTable.id, swapId))
      .returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── STAFF AVAILABILITY ──

router.get("/staff/:staffId/availability", requireAuth, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId);
    const availability = await db
      .select()
      .from(staffAvailabilityTable)
      .where(eq(staffAvailabilityTable.staffId, staffId))
      .orderBy(staffAvailabilityTable.dayOfWeek, staffAvailabilityTable.startTime);

    res.json(availability);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/staff/:staffId/availability", requireAuth, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId);
    if (isNaN(staffId)) return res.status(400).json({ error: "Invalid staff ID" });

    const caller = await resolveStaffFromClerk(req.userId!);
    if (!caller) return res.status(400).json({ error: "Staff record not found" });
    if (caller.id !== staffId && req.userRole !== "admin" && req.userRole !== "manager") {
      return res.status(403).json({ error: "You can only update your own availability" });
    }

    const { availability } = req.body;

    await db.delete(staffAvailabilityTable).where(eq(staffAvailabilityTable.staffId, staffId));

    if (availability && availability.length > 0) {
      const rows = availability.map((a: any) => ({
        staffId,
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isAvailable: a.isAvailable !== false,
        notes: a.notes || null,
        effectiveFrom: a.effectiveFrom ? new Date(a.effectiveFrom) : new Date(),
        effectiveUntil: a.effectiveUntil ? new Date(a.effectiveUntil) : null,
      }));
      await db.insert(staffAvailabilityTable).values(rows);
    }

    const updated = await db
      .select()
      .from(staffAvailabilityTable)
      .where(eq(staffAvailabilityTable.staffId, staffId))
      .orderBy(staffAvailabilityTable.dayOfWeek);

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── ONBOARDING ──

router.get("/onboarding/checklist", requireAuth, async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(onboardingChecklistTable)
      .orderBy(onboardingChecklistTable.sortOrder);
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/onboarding/checklist", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { name, description, category, isRequired, sortOrder } = req.body;
    const [item] = await db.insert(onboardingChecklistTable).values({
      name,
      description,
      category: category || "general",
      isRequired: isRequired !== false,
      sortOrder: sortOrder || 0,
    }).returning();
    res.status(201).json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/onboarding/staff/:staffId", requireAuth, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId);

    const checklist = await db.select().from(onboardingChecklistTable).orderBy(onboardingChecklistTable.sortOrder);
    const progress = await db.select().from(onboardingProgressTable).where(eq(onboardingProgressTable.staffId, staffId));

    const progressMap = new Map(progress.map((p) => [p.checklistItemId, p]));

    const combined = checklist.map((item) => ({
      ...item,
      progress: progressMap.get(item.id) || null,
      isCompleted: progressMap.get(item.id)?.isCompleted || false,
    }));

    const total = checklist.length;
    const completed = combined.filter((c) => c.isCompleted).length;
    const requiredTotal = checklist.filter((c) => c.isRequired).length;
    const requiredCompleted = combined.filter((c) => c.isCompleted && c.isRequired).length;

    res.json({
      staffId,
      items: combined,
      total,
      completed,
      requiredTotal,
      requiredCompleted,
      percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
      isFullyOnboarded: requiredCompleted >= requiredTotal,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/onboarding/staff/:staffId/complete/:itemId", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId);
    const itemId = parseInt(req.params.itemId);
    if (isNaN(staffId) || isNaN(itemId)) return res.status(400).json({ error: "Invalid staff or item ID" });
    const { notes, documentUrl } = req.body;
    const completedBy = req.userId;

    const [existing] = await db
      .select()
      .from(onboardingProgressTable)
      .where(and(eq(onboardingProgressTable.staffId, staffId), eq(onboardingProgressTable.checklistItemId, itemId)));

    if (existing) {
      const [updated] = await db
        .update(onboardingProgressTable)
        .set({ isCompleted: true, completedAt: new Date(), completedBy, notes, documentUrl })
        .where(eq(onboardingProgressTable.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(onboardingProgressTable).values({
      staffId,
      checklistItemId: itemId,
      isCompleted: true,
      completedAt: new Date(),
      completedBy,
      notes,
      documentUrl,
    }).returning();

    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/onboarding/summary", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const staff = await db.select().from(staffTable).where(eq(staffTable.status, "active"));
    const checklist = await db.select().from(onboardingChecklistTable);
    const allProgress = await db.select().from(onboardingProgressTable);

    const requiredItems = checklist.filter((c) => c.isRequired);
    const requiredIds = new Set(requiredItems.map((r) => r.id));

    const summary = staff.map((s) => {
      const myProgress = allProgress.filter((p) => p.staffId === s.id);
      const completedRequired = myProgress.filter((p) => p.isCompleted && requiredIds.has(p.checklistItemId)).length;
      const totalCompleted = myProgress.filter((p) => p.isCompleted).length;

      return {
        staffId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        role: s.role,
        hireDate: s.hireDate,
        totalItems: checklist.length,
        completedItems: totalCompleted,
        requiredItems: requiredItems.length,
        completedRequired,
        percentComplete: checklist.length > 0 ? Math.round((totalCompleted / checklist.length) * 100) : 0,
        isFullyOnboarded: completedRequired >= requiredItems.length,
      };
    });

    res.json(summary);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── OVERTIME ALERTS ──

router.get("/overtime/alerts", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { status } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(overtimeAlertsTable.status, status as string));

    const alerts = await db
      .select({
        id: overtimeAlertsTable.id,
        staffId: overtimeAlertsTable.staffId,
        staffName: sql<string>`${staffTable.firstName} || ' ' || ${staffTable.lastName}`,
        weekStartDate: overtimeAlertsTable.weekStartDate,
        totalHours: overtimeAlertsTable.totalHours,
        thresholdHours: overtimeAlertsTable.thresholdHours,
        status: overtimeAlertsTable.status,
        createdAt: overtimeAlertsTable.createdAt,
      })
      .from(overtimeAlertsTable)
      .leftJoin(staffTable, eq(overtimeAlertsTable.staffId, staffTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(overtimeAlertsTable.createdAt));

    res.json(alerts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/overtime/calculate", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const hoursPerStaff = await db
      .select({
        staffId: timePunchesTable.staffId,
        totalMinutes: sql<number>`
          COALESCE(SUM(
            CASE WHEN ${timePunchesTable.type} = 'clock_out'
            THEN EXTRACT(EPOCH FROM (${timePunchesTable.punchTime} - (
              SELECT MAX(tp2.punch_time)
              FROM time_punches tp2
              WHERE tp2.staff_id = ${timePunchesTable.staffId}
                AND tp2.type = 'clock_in'
                AND tp2.punch_time < ${timePunchesTable.punchTime}
                AND tp2.punch_time >= ${sql.raw(`'${weekStart.toISOString()}'`)}
            ))) / 60
            ELSE 0 END
          ), 0)::float`,
      })
      .from(timePunchesTable)
      .where(
        and(
          gte(timePunchesTable.punchTime, weekStart),
          lte(timePunchesTable.punchTime, weekEnd),
          eq(timePunchesTable.type, "clock_out")
        )
      )
      .groupBy(timePunchesTable.staffId);

    const threshold = 40;
    const newAlerts: any[] = [];

    for (const row of hoursPerStaff) {
      const totalHours = row.totalMinutes / 60;
      if (totalHours >= threshold * 0.9) {
        const [existing] = await db
          .select()
          .from(overtimeAlertsTable)
          .where(
            and(
              eq(overtimeAlertsTable.staffId, row.staffId),
              eq(overtimeAlertsTable.weekStartDate, weekStart)
            )
          );

        if (!existing) {
          const [alert] = await db.insert(overtimeAlertsTable).values({
            staffId: row.staffId,
            weekStartDate: weekStart,
            totalHours: totalHours.toFixed(2),
            thresholdHours: threshold.toFixed(2),
            status: totalHours >= threshold ? "overtime" : "warning",
          }).returning();
          newAlerts.push(alert);
        } else {
          await db
            .update(overtimeAlertsTable)
            .set({
              totalHours: totalHours.toFixed(2),
              status: totalHours >= threshold ? "overtime" : "warning",
            })
            .where(eq(overtimeAlertsTable.id, existing.id));
        }
      }
    }

    res.json({ calculated: hoursPerStaff.length, newAlerts: newAlerts.length, weekStart });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/overtime/alerts/:id/acknowledge", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const [updated] = await db
      .update(overtimeAlertsTable)
      .set({ status: "acknowledged", acknowledgedBy: req.userId, acknowledgedAt: new Date() })
      .where(eq(overtimeAlertsTable.id, parseInt(req.params.id)))
      .returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── ATTENDANCE RECORDS ──

router.get("/attendance", requireAuth, async (req, res) => {
  try {
    const { staffId, type } = req.query;
    const conditions: any[] = [];
    if (staffId) conditions.push(eq(attendanceRecordsTable.staffId, parseInt(staffId as string)));
    if (type) conditions.push(eq(attendanceRecordsTable.type, type as string));

    const records = await db
      .select({
        id: attendanceRecordsTable.id,
        staffId: attendanceRecordsTable.staffId,
        staffName: sql<string>`${staffTable.firstName} || ' ' || ${staffTable.lastName}`,
        shiftId: attendanceRecordsTable.shiftId,
        type: attendanceRecordsTable.type,
        minutesLate: attendanceRecordsTable.minutesLate,
        scheduledStart: attendanceRecordsTable.scheduledStart,
        actualStart: attendanceRecordsTable.actualStart,
        notes: attendanceRecordsTable.notes,
        createdAt: attendanceRecordsTable.createdAt,
      })
      .from(attendanceRecordsTable)
      .leftJoin(staffTable, eq(attendanceRecordsTable.staffId, staffTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(attendanceRecordsTable.createdAt));

    res.json(records);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/attendance", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { staffId, shiftId, type, minutesLate, scheduledStart, actualStart, notes } = req.body;

    if (!staffId || !type) return res.status(400).json({ error: "staffId and type are required" });
    const validTypes = ["no_show", "tardy", "early_departure"];
    if (!validTypes.includes(type)) return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });

    const [record] = await db.insert(attendanceRecordsTable).values({
      staffId,
      shiftId,
      type,
      minutesLate: minutesLate || 0,
      scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
      actualStart: actualStart ? new Date(actualStart) : null,
      reportedBy: req.userId,
      notes,
    }).returning();

    if (type === "no_show" && shiftId) {
      await db.update(shiftsTable).set({ status: "no_show" }).where(eq(shiftsTable.id, shiftId));
    }

    res.status(201).json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/attendance/summary", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const summary = await db
      .select({
        staffId: attendanceRecordsTable.staffId,
        staffName: sql<string>`${staffTable.firstName} || ' ' || ${staffTable.lastName}`,
        noShows: sql<number>`count(*) FILTER (WHERE ${attendanceRecordsTable.type} = 'no_show')::int`,
        tardies: sql<number>`count(*) FILTER (WHERE ${attendanceRecordsTable.type} = 'tardy')::int`,
        earlyDepartures: sql<number>`count(*) FILTER (WHERE ${attendanceRecordsTable.type} = 'early_departure')::int`,
        totalIncidents: sql<number>`count(*)::int`,
        avgMinutesLate: sql<number>`COALESCE(AVG(${attendanceRecordsTable.minutesLate}) FILTER (WHERE ${attendanceRecordsTable.type} = 'tardy'), 0)::float`,
      })
      .from(attendanceRecordsTable)
      .leftJoin(staffTable, eq(attendanceRecordsTable.staffId, staffTable.id))
      .where(gte(attendanceRecordsTable.createdAt, thirtyDaysAgo))
      .groupBy(attendanceRecordsTable.staffId, staffTable.firstName, staffTable.lastName)
      .orderBy(desc(sql`count(*)`));

    res.json(summary);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
