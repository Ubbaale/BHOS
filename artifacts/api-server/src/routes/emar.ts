import { Router, type IRouter } from "express";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { db, medicationsTable, patientsTable, medicationAdministrationsTable, staffTable, homesTable } from "@workspace/db";

const router: IRouter = Router();

function parseScheduleTimes(frequency: string, scheduleTimesJson: string | null): string[] {
  if (scheduleTimesJson) {
    try {
      const parsed = JSON.parse(scheduleTimesJson);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  const lower = frequency.toLowerCase();
  if (lower.includes("twice daily") || lower.includes("bid") || lower.includes("2x")) {
    return ["08:00", "20:00"];
  }
  if (lower.includes("three times") || lower.includes("tid") || lower.includes("3x")) {
    return ["08:00", "14:00", "20:00"];
  }
  if (lower.includes("four times") || lower.includes("qid") || lower.includes("4x")) {
    return ["08:00", "12:00", "16:00", "20:00"];
  }
  if (lower.includes("bedtime") || lower.includes("hs") || lower.includes("at night")) {
    return ["21:00"];
  }
  if (lower.includes("morning")) {
    return ["08:00"];
  }
  return ["08:00"];
}

router.get("/emar", async (req, res): Promise<void> => {
  try {
  const homeId = req.query.homeId ? Number(req.query.homeId) : undefined;
  const dateStr = req.query.date as string | undefined;
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(targetDate.getTime())) {
    res.status(400).json({ error: "Invalid date parameter" });
    return;
  }
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const day = targetDate.getDate();

  let medsQuery = db
    .select({
      id: medicationsTable.id,
      patientId: medicationsTable.patientId,
      patientFirstName: patientsTable.firstName,
      patientLastName: patientsTable.lastName,
      homeId: patientsTable.homeId,
      homeName: homesTable.name,
      name: medicationsTable.name,
      dosage: medicationsTable.dosage,
      route: medicationsTable.route,
      frequency: medicationsTable.frequency,
      controlledSubstance: medicationsTable.controlledSubstance,
      deaSchedule: medicationsTable.deaSchedule,
      medicationType: medicationsTable.medicationType,
      instructions: medicationsTable.instructions,
      scheduleTimesJson: medicationsTable.scheduleTimesJson,
    })
    .from(medicationsTable)
    .innerJoin(patientsTable, eq(medicationsTable.patientId, patientsTable.id))
    .leftJoin(homesTable, eq(patientsTable.homeId, homesTable.id))
    .where(
      and(
        eq(medicationsTable.active, true),
        eq(medicationsTable.medicationType, "scheduled")
      )
    )
    .$dynamic();

  if (homeId) {
    medsQuery = medsQuery.where(eq(patientsTable.homeId, homeId));
  }

  const meds = await medsQuery;

  const dayStart = new Date(year, month, day, 0, 0, 0);
  const dayEnd = new Date(year, month, day, 23, 59, 59);

  const admins = await db
    .select({
      id: medicationAdministrationsTable.id,
      medicationId: medicationAdministrationsTable.medicationId,
      patientId: medicationAdministrationsTable.patientId,
      administeredAt: medicationAdministrationsTable.administeredAt,
      status: medicationAdministrationsTable.status,
      staffId: medicationAdministrationsTable.staffId,
      staffFirstName: staffTable.firstName,
      staffLastName: staffTable.lastName,
      scheduledTime: medicationAdministrationsTable.scheduledTime,
      barcodeScanVerified: medicationAdministrationsTable.barcodeScanVerified,
    })
    .from(medicationAdministrationsTable)
    .leftJoin(staffTable, eq(medicationAdministrationsTable.staffId, staffTable.id))
    .where(
      and(
        gte(medicationAdministrationsTable.administeredAt, dayStart),
        lte(medicationAdministrationsTable.administeredAt, dayEnd)
      )
    );

  const now = new Date();
  const entries: any[] = [];

  for (const med of meds) {
    const times = parseScheduleTimes(med.frequency, med.scheduleTimesJson);

    for (const timeStr of times) {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const scheduledTime = new Date(year, month, day, hours, minutes, 0);
      const windowStart = new Date(scheduledTime.getTime() - 30 * 60 * 1000);
      const windowEnd = new Date(scheduledTime.getTime() + 60 * 60 * 1000);

      const matchingAdmin = admins.find(a =>
        a.medicationId === med.id &&
        a.patientId === med.patientId &&
        a.administeredAt >= windowStart &&
        a.administeredAt <= windowEnd
      );

      let status = "pending";
      if (matchingAdmin) {
        status = matchingAdmin.status;
      } else if (now > windowEnd) {
        status = "overdue";
      }

      entries.push({
        patientId: med.patientId,
        patientName: `${med.patientFirstName} ${med.patientLastName}`,
        homeId: med.homeId,
        homeName: med.homeName,
        medicationId: med.id,
        medicationName: med.name,
        dosage: med.dosage,
        route: med.route,
        frequency: med.frequency,
        controlledSubstance: med.controlledSubstance,
        deaSchedule: med.deaSchedule,
        medicationType: med.medicationType,
        scheduledTime: scheduledTime.toISOString(),
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        status,
        administeredAt: matchingAdmin?.administeredAt?.toISOString() ?? null,
        administeredBy: matchingAdmin ? `${matchingAdmin.staffFirstName} ${matchingAdmin.staffLastName}` : null,
        administrationId: matchingAdmin?.id ?? null,
        barcodeScanVerified: matchingAdmin?.barcodeScanVerified ?? false,
        instructions: med.instructions,
      });
    }
  }

  entries.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  res.json(entries);
  } catch (err) {
    console.error("eMAR error:", err);
    res.status(500).json({ error: "Failed to load eMAR data" });
  }
});

export default router;
