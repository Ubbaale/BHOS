import { Router, type IRouter } from "express";
import { eq, and, sql, desc, gte, isNull } from "drizzle-orm";
import {
  db, medicationsTable, patientsTable, staffTable,
  vitalSignsTable, medicationSideEffectsTable,
  medicationRefusalsTable, medicationAuditLogTable,
  medicationAdministrationsTable,
} from "@workspace/db";
import {
  CreateVitalSignsBody,
  CreateMedicationSideEffectBody,
  CreateMedicationRefusalBody,
  UpdatePrnFollowupBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/vital-signs", async (req, res): Promise<void> => {
  try {
    const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
    const administrationId = req.query.administrationId ? Number(req.query.administrationId) : undefined;

    let query = db
      .select({
        id: vitalSignsTable.id,
        patientId: vitalSignsTable.patientId,
        patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
        staffId: vitalSignsTable.staffId,
        staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
        administrationId: vitalSignsTable.administrationId,
        systolicBp: vitalSignsTable.systolicBp,
        diastolicBp: vitalSignsTable.diastolicBp,
        heartRate: vitalSignsTable.heartRate,
        temperature: sql<number | null>`${vitalSignsTable.temperature}::float`,
        respiratoryRate: vitalSignsTable.respiratoryRate,
        oxygenSaturation: vitalSignsTable.oxygenSaturation,
        painLevel: vitalSignsTable.painLevel,
        notes: vitalSignsTable.notes,
        recordedAt: vitalSignsTable.recordedAt,
        createdAt: vitalSignsTable.createdAt,
      })
      .from(vitalSignsTable)
      .innerJoin(patientsTable, eq(vitalSignsTable.patientId, patientsTable.id))
      .innerJoin(staffTable, eq(vitalSignsTable.staffId, staffTable.id))
      .orderBy(desc(vitalSignsTable.recordedAt))
      .$dynamic();

    if (patientId) query = query.where(eq(vitalSignsTable.patientId, patientId));
    if (administrationId) query = query.where(eq(vitalSignsTable.administrationId, administrationId));

    const result = await query;
    res.json(result);
  } catch (err) {
    console.error("Vital signs list error:", err);
    res.status(500).json({ error: "Failed to list vital signs" });
  }
});

router.post("/vital-signs", async (req, res): Promise<void> => {
  try {
    const parsed = CreateVitalSignsBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }

    const result = await db.insert(vitalSignsTable).values({
      ...parsed.data,
      recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
    }).returning();

    await db.insert(medicationAuditLogTable).values({
      entityType: "vital_signs",
      entityId: result[0].id,
      action: "create",
      performedBy: parsed.data.staffId,
      details: `Vitals recorded: BP ${parsed.data.systolicBp || '-'}/${parsed.data.diastolicBp || '-'}, HR ${parsed.data.heartRate || '-'}`,
    });

    res.status(201).json(result[0]);
  } catch (err) {
    console.error("Vital signs create error:", err);
    res.status(500).json({ error: "Failed to record vital signs" });
  }
});

router.get("/medication-side-effects", async (req, res): Promise<void> => {
  try {
    const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
    const medicationId = req.query.medicationId ? Number(req.query.medicationId) : undefined;

    let query = db
      .select({
        id: medicationSideEffectsTable.id,
        medicationId: medicationSideEffectsTable.medicationId,
        medicationName: medicationsTable.name,
        patientId: medicationSideEffectsTable.patientId,
        patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
        staffId: medicationSideEffectsTable.staffId,
        staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
        administrationId: medicationSideEffectsTable.administrationId,
        sideEffect: medicationSideEffectsTable.sideEffect,
        severity: medicationSideEffectsTable.severity,
        onsetTime: medicationSideEffectsTable.onsetTime,
        resolved: medicationSideEffectsTable.resolved,
        resolvedAt: medicationSideEffectsTable.resolvedAt,
        notes: medicationSideEffectsTable.notes,
        createdAt: medicationSideEffectsTable.createdAt,
      })
      .from(medicationSideEffectsTable)
      .innerJoin(medicationsTable, eq(medicationSideEffectsTable.medicationId, medicationsTable.id))
      .innerJoin(patientsTable, eq(medicationSideEffectsTable.patientId, patientsTable.id))
      .innerJoin(staffTable, eq(medicationSideEffectsTable.staffId, staffTable.id))
      .orderBy(desc(medicationSideEffectsTable.createdAt))
      .$dynamic();

    if (patientId) query = query.where(eq(medicationSideEffectsTable.patientId, patientId));
    if (medicationId) query = query.where(eq(medicationSideEffectsTable.medicationId, medicationId));

    const result = await query;
    res.json(result);
  } catch (err) {
    console.error("Side effects list error:", err);
    res.status(500).json({ error: "Failed to list side effects" });
  }
});

router.post("/medication-side-effects", async (req, res): Promise<void> => {
  try {
    const parsed = CreateMedicationSideEffectBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }

    const result = await db.insert(medicationSideEffectsTable).values({
      ...parsed.data,
      onsetTime: parsed.data.onsetTime ? new Date(parsed.data.onsetTime) : new Date(),
    }).returning();

    await db.insert(medicationAuditLogTable).values({
      entityType: "side_effect",
      entityId: result[0].id,
      action: "create",
      performedBy: parsed.data.staffId,
      details: `Side effect reported: ${parsed.data.sideEffect} (${parsed.data.severity})`,
    });

    res.status(201).json(result[0]);
  } catch (err) {
    console.error("Side effect create error:", err);
    res.status(500).json({ error: "Failed to report side effect" });
  }
});

router.get("/medication-refusals", async (req, res): Promise<void> => {
  try {
    const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;

    let query = db
      .select({
        id: medicationRefusalsTable.id,
        medicationId: medicationRefusalsTable.medicationId,
        medicationName: medicationsTable.name,
        patientId: medicationRefusalsTable.patientId,
        patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
        staffId: medicationRefusalsTable.staffId,
        staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
        scheduledTime: medicationRefusalsTable.scheduledTime,
        reason: medicationRefusalsTable.reason,
        physicianNotified: medicationRefusalsTable.physicianNotified,
        physicianNotifiedAt: medicationRefusalsTable.physicianNotifiedAt,
        physicianName: medicationRefusalsTable.physicianName,
        followUpAction: medicationRefusalsTable.followUpAction,
        followUpNotes: medicationRefusalsTable.followUpNotes,
        createdAt: medicationRefusalsTable.createdAt,
      })
      .from(medicationRefusalsTable)
      .innerJoin(medicationsTable, eq(medicationRefusalsTable.medicationId, medicationsTable.id))
      .innerJoin(patientsTable, eq(medicationRefusalsTable.patientId, patientsTable.id))
      .innerJoin(staffTable, eq(medicationRefusalsTable.staffId, staffTable.id))
      .orderBy(desc(medicationRefusalsTable.createdAt))
      .$dynamic();

    if (patientId) query = query.where(eq(medicationRefusalsTable.patientId, patientId));

    const result = await query;
    res.json(result);
  } catch (err) {
    console.error("Refusals list error:", err);
    res.status(500).json({ error: "Failed to list refusals" });
  }
});

router.post("/medication-refusals", async (req, res): Promise<void> => {
  try {
    const parsed = CreateMedicationRefusalBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }

    const result = await db.insert(medicationRefusalsTable).values({
      ...parsed.data,
      scheduledTime: parsed.data.scheduledTime ? new Date(parsed.data.scheduledTime) : undefined,
    }).returning();

    await db.insert(medicationAuditLogTable).values({
      entityType: "refusal",
      entityId: result[0].id,
      action: "create",
      performedBy: parsed.data.staffId,
      details: `Medication refused: ${parsed.data.reason}. Physician notified: ${parsed.data.physicianNotified ? "Yes" : "No"}`,
    });

    res.status(201).json(result[0]);
  } catch (err) {
    console.error("Refusal create error:", err);
    res.status(500).json({ error: "Failed to record refusal" });
  }
});

router.get("/medication-audit-log", async (req, res): Promise<void> => {
  try {
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;

    let query = db
      .select()
      .from(medicationAuditLogTable)
      .orderBy(desc(medicationAuditLogTable.createdAt))
      .limit(200)
      .$dynamic();

    if (entityType) query = query.where(eq(medicationAuditLogTable.entityType, entityType));
    if (entityId) query = query.where(eq(medicationAuditLogTable.entityId, entityId));

    const result = await query;
    res.json(result);
  } catch (err) {
    console.error("Audit log error:", err);
    res.status(500).json({ error: "Failed to list audit log" });
  }
});

router.put("/medication-administrations/:id/prn-followup", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const parsed = UpdatePrnFollowupBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }

    const result = await db.update(medicationAdministrationsTable)
      .set({
        prnEffectivenessScore: parsed.data.prnEffectivenessScore,
        prnEffectiveness: parsed.data.prnEffectiveness,
        prnFollowUpNotes: parsed.data.prnFollowUpNotes,
        prnFollowUpAt: new Date(),
      })
      .where(eq(medicationAdministrationsTable.id, id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "Administration not found" });
      return;
    }

    await db.insert(medicationAuditLogTable).values({
      entityType: "administration",
      entityId: id,
      action: "prn_followup",
      performedBy: result[0].staffId,
      details: `PRN follow-up: score ${parsed.data.prnEffectivenessScore}/10, ${parsed.data.prnEffectiveness}`,
    });

    res.json(result[0]);
  } catch (err) {
    console.error("PRN follow-up error:", err);
    res.status(500).json({ error: "Failed to record PRN follow-up" });
  }
});

router.get("/medication-administrations/pending-followups", async (req, res): Promise<void> => {
  try {
    const now = new Date();

    const result = await db
      .select({
        id: medicationAdministrationsTable.id,
        medicationId: medicationAdministrationsTable.medicationId,
        medicationName: medicationsTable.name,
        patientId: medicationAdministrationsTable.patientId,
        patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
        staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
        prnReason: medicationAdministrationsTable.prnReason,
        administeredAt: medicationAdministrationsTable.administeredAt,
        prnFollowUpDueAt: medicationAdministrationsTable.prnFollowUpDueAt,
      })
      .from(medicationAdministrationsTable)
      .innerJoin(medicationsTable, eq(medicationAdministrationsTable.medicationId, medicationsTable.id))
      .innerJoin(patientsTable, eq(medicationAdministrationsTable.patientId, patientsTable.id))
      .innerJoin(staffTable, eq(medicationAdministrationsTable.staffId, staffTable.id))
      .where(and(
        isNull(medicationAdministrationsTable.prnEffectivenessScore),
        sql`${medicationAdministrationsTable.prnReason} IS NOT NULL`,
        sql`${medicationAdministrationsTable.prnFollowUpDueAt} IS NOT NULL`,
      ))
      .orderBy(medicationAdministrationsTable.prnFollowUpDueAt);

    const items = result.map(r => ({
      ...r,
      administeredAt: r.administeredAt.toISOString(),
      prnFollowUpDueAt: r.prnFollowUpDueAt?.toISOString() ?? now.toISOString(),
      minutesRemaining: Math.round(((r.prnFollowUpDueAt?.getTime() ?? now.getTime()) - now.getTime()) / 60000),
    }));

    res.json(items);
  } catch (err) {
    console.error("Pending follow-ups error:", err);
    res.status(500).json({ error: "Failed to list pending follow-ups" });
  }
});

export default router;
