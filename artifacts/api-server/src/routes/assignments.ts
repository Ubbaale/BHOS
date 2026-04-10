import { Router } from "express";
import { db } from "@workspace/db";
import { dailyAssignmentsTable, staffTable, patientsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

async function resolveStaffFromClerk(clerkUserId: string) {
  const { clerkClient } = await import("@clerk/express");
  const user = await clerkClient.users.getUser(clerkUserId);
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (!email) return null;
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.email, email));
  return staff || null;
}

router.get("/assignments/today", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { homeId } = req.query;
    const conditions: any[] = [
      gte(dailyAssignmentsTable.assignmentDate, today),
      lte(dailyAssignmentsTable.assignmentDate, tomorrow),
    ];
    if (homeId) conditions.push(eq(dailyAssignmentsTable.homeId, Number(homeId)));

    const assignments = await db
      .select()
      .from(dailyAssignmentsTable)
      .where(and(...conditions))
      .orderBy(dailyAssignmentsTable.createdAt);

    res.json(assignments);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/assignments/my", requireAuth, async (req, res) => {
  try {
    const staff = await resolveStaffFromClerk(req.userId!);
    if (!staff) return res.status(403).json({ error: "Staff not found" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const assignments = await db
      .select()
      .from(dailyAssignmentsTable)
      .where(
        and(
          eq(dailyAssignmentsTable.staffId, staff.id),
          gte(dailyAssignmentsTable.assignmentDate, today),
          lte(dailyAssignmentsTable.assignmentDate, tomorrow)
        )
      )
      .orderBy(dailyAssignmentsTable.createdAt);

    const enriched = await Promise.all(
      assignments.map(async (a) => {
        const patientIdList = a.patientIds.split(",").map(Number).filter(Boolean);
        const patients = [];
        for (const pid of patientIdList) {
          const [p] = await db.select({ id: patientsTable.id, firstName: patientsTable.firstName, lastName: patientsTable.lastName }).from(patientsTable).where(eq(patientsTable.id, pid));
          if (p) patients.push(p);
        }
        return { ...a, patients };
      })
    );

    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/assignments", requireAuth, async (req, res) => {
  try {
    const { homeId, date, staffId } = req.query;
    const conditions: any[] = [];

    if (homeId) conditions.push(eq(dailyAssignmentsTable.homeId, Number(homeId)));
    if (staffId) conditions.push(eq(dailyAssignmentsTable.staffId, Number(staffId)));
    if (date) {
      const d = new Date(String(date));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      conditions.push(gte(dailyAssignmentsTable.assignmentDate, d));
      conditions.push(lte(dailyAssignmentsTable.assignmentDate, next));
    }

    const assignments = await db
      .select()
      .from(dailyAssignmentsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dailyAssignmentsTable.assignmentDate));

    res.json(assignments);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/assignments", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { staffId, homeId, assignmentDate, shiftType, patientIds, assignedTasks, specialInstructions } = req.body;

    if (!staffId || !homeId || !assignmentDate || !patientIds) {
      return res.status(400).json({ error: "staffId, homeId, assignmentDate, and patientIds are required" });
    }

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
    if (!staff) return res.status(404).json({ error: "Staff not found" });

    const [assignment] = await db.insert(dailyAssignmentsTable).values({
      staffId,
      homeId,
      assignmentDate: new Date(assignmentDate),
      shiftType: shiftType || "day",
      patientIds: Array.isArray(patientIds) ? patientIds.join(",") : String(patientIds),
      assignedTasks: assignedTasks || null,
      specialInstructions: specialInstructions || null,
      status: "active",
      assignedBy: req.userId,
    }).returning();

    res.status(201).json(assignment);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/assignments/auto-assign", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { homeId, date } = req.body;
    if (!homeId) return res.status(400).json({ error: "homeId is required" });

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const activeStaff = await db
      .select()
      .from(staffTable)
      .where(
        and(
          eq(staffTable.homeId, homeId),
          eq(staffTable.status, "active")
        )
      );

    const patients = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.homeId, homeId));

    if (activeStaff.length === 0) {
      return res.status(400).json({ error: "No active staff at this home" });
    }
    if (patients.length === 0) {
      return res.status(400).json({ error: "No patients at this home" });
    }

    const patientIds = patients.map(p => p.id);
    const patientsPerStaff = Math.ceil(patientIds.length / activeStaff.length);

    const assignments = [];
    for (let i = 0; i < activeStaff.length; i++) {
      const staffPatients = patientIds.slice(i * patientsPerStaff, (i + 1) * patientsPerStaff);
      if (staffPatients.length === 0) continue;

      const [assignment] = await db.insert(dailyAssignmentsTable).values({
        staffId: activeStaff[i].id,
        homeId,
        assignmentDate: targetDate,
        shiftType: "day",
        patientIds: staffPatients.join(","),
        assignedTasks: "Medication administration, Vital signs monitoring, Daily log documentation, Patient care",
        status: "active",
        assignedBy: req.userId,
      }).returning();

      assignments.push({
        ...assignment,
        staffName: `${activeStaff[i].firstName} ${activeStaff[i].lastName}`,
        patientCount: staffPatients.length,
      });
    }

    res.status(201).json({ message: `Auto-assigned ${patients.length} patients to ${activeStaff.length} staff`, assignments });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/assignments/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const updates: any = {};
    const allowedFields = ["shiftType", "patientIds", "assignedTasks", "specialInstructions", "status", "clockedInAt", "clockedOutAt"];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "patientIds" && Array.isArray(req.body[field])) {
          updates[field] = req.body[field].join(",");
        } else if (field === "clockedInAt" || field === "clockedOutAt") {
          updates[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    const [updated] = await db
      .update(dailyAssignmentsTable)
      .set(updates)
      .where(eq(dailyAssignmentsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Assignment not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/assignments/:id/clock-in", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const staff = await resolveStaffFromClerk(req.userId!);
    if (!staff) return res.status(403).json({ error: "Staff not found" });

    const [assignment] = await db.select().from(dailyAssignmentsTable).where(eq(dailyAssignmentsTable.id, id));
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.staffId !== staff.id) return res.status(403).json({ error: "This assignment is not yours" });

    const [updated] = await db
      .update(dailyAssignmentsTable)
      .set({ clockedInAt: new Date(), status: "in_progress" })
      .where(eq(dailyAssignmentsTable.id, id))
      .returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/assignments/:id/clock-out", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const staff = await resolveStaffFromClerk(req.userId!);
    if (!staff) return res.status(403).json({ error: "Staff not found" });

    const [assignment] = await db.select().from(dailyAssignmentsTable).where(eq(dailyAssignmentsTable.id, id));
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.staffId !== staff.id) return res.status(403).json({ error: "This assignment is not yours" });

    const [updated] = await db
      .update(dailyAssignmentsTable)
      .set({ clockedOutAt: new Date(), status: "completed" })
      .where(eq(dailyAssignmentsTable.id, id))
      .returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
