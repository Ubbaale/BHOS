import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, medicationsTable, patientsTable, medicationAdministrationsTable, staffTable, medicationAuditLogTable } from "@workspace/db";
import {
  CreateMedicationBody,
  ListMedicationsResponse,
  ListMedicationsQueryParams,
  CreateMedicationAdministrationBody,
  ListMedicationAdministrationsResponse,
  ListMedicationAdministrationsQueryParams,
} from "@workspace/api-zod";
import { pinVerificationTokens } from "./med-pass-pin";

const router: IRouter = Router();

const medSelect = {
  id: medicationsTable.id,
  patientId: medicationsTable.patientId,
  patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
  name: medicationsTable.name,
  dosage: medicationsTable.dosage,
  frequency: medicationsTable.frequency,
  route: medicationsTable.route,
  prescribedBy: medicationsTable.prescribedBy,
  startDate: medicationsTable.startDate,
  endDate: medicationsTable.endDate,
  active: medicationsTable.active,
  instructions: medicationsTable.instructions,
  controlledSubstance: medicationsTable.controlledSubstance,
  deaSchedule: medicationsTable.deaSchedule,
  ndcCode: medicationsTable.ndcCode,
  medicationType: medicationsTable.medicationType,
  quantityOnHand: medicationsTable.quantityOnHand,
  quantityPerRefill: medicationsTable.quantityPerRefill,
  refillThreshold: medicationsTable.refillThreshold,
  pharmacyName: medicationsTable.pharmacyName,
  pharmacyPhone: medicationsTable.pharmacyPhone,
  rxNumber: medicationsTable.rxNumber,
  scheduleTimesJson: medicationsTable.scheduleTimesJson,
  imageUrl: medicationsTable.imageUrl,
  lotNumber: medicationsTable.lotNumber,
  expirationDate: medicationsTable.expirationDate,
  createdAt: medicationsTable.createdAt,
};

const adminSelect = {
  id: medicationAdministrationsTable.id,
  medicationId: medicationAdministrationsTable.medicationId,
  medicationName: medicationsTable.name,
  patientId: medicationAdministrationsTable.patientId,
  patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
  staffId: medicationAdministrationsTable.staffId,
  staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
  administeredAt: medicationAdministrationsTable.administeredAt,
  status: medicationAdministrationsTable.status,
  notes: medicationAdministrationsTable.notes,
  scheduledTime: medicationAdministrationsTable.scheduledTime,
  windowStart: medicationAdministrationsTable.windowStart,
  windowEnd: medicationAdministrationsTable.windowEnd,
  prnReason: medicationAdministrationsTable.prnReason,
  prnEffectiveness: medicationAdministrationsTable.prnEffectiveness,
  prnFollowUpAt: medicationAdministrationsTable.prnFollowUpAt,
  prnFollowUpNotes: medicationAdministrationsTable.prnFollowUpNotes,
  barcodeScanVerified: medicationAdministrationsTable.barcodeScanVerified,
  witnessStaffId: medicationAdministrationsTable.witnessStaffId,
  relatedIncidentId: medicationAdministrationsTable.relatedIncidentId,
  createdAt: medicationAdministrationsTable.createdAt,
};

router.get("/medications", async (req, res): Promise<void> => {
  const queryParams = ListMedicationsQueryParams.safeParse(req.query);

  let query = db
    .select(medSelect)
    .from(medicationsTable)
    .leftJoin(patientsTable, eq(medicationsTable.patientId, patientsTable.id))
    .orderBy(medicationsTable.name)
    .$dynamic();

  if (queryParams.success && queryParams.data.patientId) {
    query = query.where(eq(medicationsTable.patientId, queryParams.data.patientId));
  }

  const medications = await query;
  res.json(ListMedicationsResponse.parse(medications));
});

router.post("/medications", async (req, res): Promise<void> => {
  const parsed = CreateMedicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [med] = await db.insert(medicationsTable).values(parsed.data).returning();

  const [result] = await db
    .select(medSelect)
    .from(medicationsTable)
    .leftJoin(patientsTable, eq(medicationsTable.patientId, patientsTable.id))
    .where(eq(medicationsTable.id, med.id));

  res.status(201).json(result);
});

router.get("/medications/barcode-lookup/:code", async (req, res): Promise<void> => {
  const code = req.params.code.trim();
  if (!code) {
    res.status(400).json({ error: "Barcode code is required" });
    return;
  }

  const matches = await db
    .select(medSelect)
    .from(medicationsTable)
    .leftJoin(patientsTable, eq(medicationsTable.patientId, patientsTable.id))
    .where(
      sql`${medicationsTable.ndcCode} = ${code} 
        OR ${medicationsTable.rxNumber} = ${code}
        OR ${medicationsTable.lotNumber} = ${code}`
    );

  if (matches.length === 0) {
    res.json({ found: false, medications: [], scannedCode: code });
    return;
  }

  res.json({ found: true, medications: matches, scannedCode: code });
});

router.get("/medication-administrations", async (req, res): Promise<void> => {
  const queryParams = ListMedicationAdministrationsQueryParams.safeParse(req.query);

  let query = db
    .select(adminSelect)
    .from(medicationAdministrationsTable)
    .leftJoin(medicationsTable, eq(medicationAdministrationsTable.medicationId, medicationsTable.id))
    .leftJoin(patientsTable, eq(medicationAdministrationsTable.patientId, patientsTable.id))
    .leftJoin(staffTable, eq(medicationAdministrationsTable.staffId, staffTable.id))
    .orderBy(medicationAdministrationsTable.administeredAt)
    .$dynamic();

  if (queryParams.success && queryParams.data.patientId) {
    query = query.where(eq(medicationAdministrationsTable.patientId, queryParams.data.patientId));
  }
  if (queryParams.success && queryParams.data.homeId) {
    query = query.where(eq(patientsTable.homeId, queryParams.data.homeId));
  }

  const administrations = await query;
  res.json(ListMedicationAdministrationsResponse.parse(administrations));
});

router.post("/medication-administrations", async (req, res): Promise<void> => {
  const parsed = CreateMedicationAdministrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const pinToken = req.headers["x-pin-verification-token"] as string | undefined;
  if (!pinToken) {
    res.status(403).json({ error: "PIN verification required. Please enter your med-pass PIN before administering medication.", pinRequired: true });
    return;
  }
  const tokenData = pinVerificationTokens.get(pinToken);
  if (!tokenData) {
    res.status(403).json({ error: "Invalid or expired PIN verification token. Please re-enter your PIN.", pinRequired: true });
    return;
  }
  if (tokenData.expiresAt < Date.now()) {
    pinVerificationTokens.delete(pinToken);
    res.status(403).json({ error: "PIN verification token expired. Please re-enter your PIN.", pinRequired: true });
    return;
  }
  if (tokenData.staffId !== parsed.data.staffId) {
    res.status(403).json({ error: "PIN verification does not match the administering staff member.", pinRequired: true });
    return;
  }
  pinVerificationTokens.delete(pinToken);

  const [med] = await db
    .select({ medicationType: medicationsTable.medicationType, quantityOnHand: medicationsTable.quantityOnHand, name: medicationsTable.name })
    .from(medicationsTable)
    .where(eq(medicationsTable.id, parsed.data.medicationId));

  const insertData: any = { ...parsed.data };
  if (med?.medicationType === "prn" && parsed.data.prnReason) {
    insertData.prnFollowUpDueAt = new Date(Date.now() + 60 * 60 * 1000);
  }

  const [admin] = await db.insert(medicationAdministrationsTable).values(insertData).returning();

  if (med?.quantityOnHand != null && parsed.data.status === "given") {
    const prevQty = med.quantityOnHand;
    const newQty = Math.max(0, prevQty - 1);
    await db.update(medicationsTable)
      .set({ quantityOnHand: sql`GREATEST(0, ${medicationsTable.quantityOnHand} - 1)` })
      .where(and(eq(medicationsTable.id, parsed.data.medicationId), sql`${medicationsTable.quantityOnHand} > 0`));

    await db.insert(medicationAuditLogTable).values({
      entityType: "medication",
      entityId: parsed.data.medicationId,
      action: "auto_decrement",
      performedBy: parsed.data.staffId,
      details: `Auto-decremented ${med.name} from ${prevQty} to ${newQty} after administration`,
      previousValue: String(prevQty),
      newValue: String(newQty),
    });
  }

  await db.insert(medicationAuditLogTable).values({
    entityType: "administration",
    entityId: admin.id,
    action: "create",
    performedBy: parsed.data.staffId,
    details: `Medication administered: ${med?.name || 'Unknown'}${parsed.data.fiveRightsVerified ? ' (5 Rights verified)' : ''}`,
  });

  const [result] = await db
    .select(adminSelect)
    .from(medicationAdministrationsTable)
    .leftJoin(medicationsTable, eq(medicationAdministrationsTable.medicationId, medicationsTable.id))
    .leftJoin(patientsTable, eq(medicationAdministrationsTable.patientId, patientsTable.id))
    .leftJoin(staffTable, eq(medicationAdministrationsTable.staffId, staffTable.id))
    .where(eq(medicationAdministrationsTable.id, admin.id));

  res.status(201).json(result);
});

export default router;
