import { Router } from "express";
import { db } from "@workspace/db";
import { patientAppointmentsTable, patientsTable, staffTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

router.get("/appointments", requireAuth, async (req, res) => {
  try {
    const { homeId, patientId, status, from, to } = req.query;
    const conditions: any[] = [];

    if (homeId) conditions.push(eq(patientAppointmentsTable.homeId, Number(homeId)));
    if (patientId) conditions.push(eq(patientAppointmentsTable.patientId, Number(patientId)));
    if (status) conditions.push(eq(patientAppointmentsTable.status, String(status)));
    if (from) conditions.push(gte(patientAppointmentsTable.scheduledAt, new Date(String(from))));
    if (to) conditions.push(lte(patientAppointmentsTable.scheduledAt, new Date(String(to))));

    const appointments = await db
      .select()
      .from(patientAppointmentsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(patientAppointmentsTable.scheduledAt);

    res.json(appointments);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/appointments/today", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await db
      .select()
      .from(patientAppointmentsTable)
      .where(
        and(
          gte(patientAppointmentsTable.scheduledAt, today),
          lte(patientAppointmentsTable.scheduledAt, tomorrow)
        )
      )
      .orderBy(patientAppointmentsTable.scheduledAt);

    res.json(appointments);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/appointments/upcoming", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const appointments = await db
      .select()
      .from(patientAppointmentsTable)
      .where(
        and(
          gte(patientAppointmentsTable.scheduledAt, now),
          lte(patientAppointmentsTable.scheduledAt, nextWeek),
          eq(patientAppointmentsTable.status, "scheduled")
        )
      )
      .orderBy(patientAppointmentsTable.scheduledAt);

    res.json(appointments);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/appointments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const [appt] = await db.select().from(patientAppointmentsTable).where(eq(patientAppointmentsTable.id, id));
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    res.json(appt);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/appointments", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const { patientId, homeId, appointmentType, provider, providerPhone, location, scheduledAt, endTime, notes, transportNeeded, assignedStaffId } = req.body;

    if (!patientId || !appointmentType || !provider || !scheduledAt) {
      return res.status(400).json({ error: "patientId, appointmentType, provider, and scheduledAt are required" });
    }

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    if (assignedStaffId) {
      const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, assignedStaffId));
      if (!staff) return res.status(404).json({ error: "Assigned staff not found" });
    }

    const [appt] = await db.insert(patientAppointmentsTable).values({
      patientId,
      homeId: homeId || patient.homeId,
      appointmentType,
      provider,
      providerPhone: providerPhone || null,
      location: location || null,
      scheduledAt: new Date(scheduledAt),
      endTime: endTime ? new Date(endTime) : null,
      notes: notes || null,
      transportNeeded: transportNeeded || false,
      assignedStaffId: assignedStaffId || null,
      createdBy: req.userId,
    }).returning();

    res.status(201).json(appt);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/appointments/:id", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const updates: any = {};
    const allowedFields = ["appointmentType", "provider", "providerPhone", "location", "scheduledAt", "endTime", "status", "notes", "transportNeeded", "assignedStaffId", "outcome", "followUpDate"];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "scheduledAt" || field === "endTime" || field === "followUpDate") {
          updates[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    const [updated] = await db
      .update(patientAppointmentsTable)
      .set(updates)
      .where(eq(patientAppointmentsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Appointment not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/appointments/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const [deleted] = await db.delete(patientAppointmentsTable).where(eq(patientAppointmentsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Appointment not found" });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/appointments/patient/:patientId/history", requireAuth, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    if (isNaN(patientId)) return res.status(400).json({ error: "Invalid patient ID" });

    const appointments = await db
      .select()
      .from(patientAppointmentsTable)
      .where(eq(patientAppointmentsTable.patientId, patientId))
      .orderBy(desc(patientAppointmentsTable.scheduledAt));

    res.json(appointments);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
