import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, patientsTable, homesTable } from "@workspace/db";
import {
  CreatePatientBody,
  GetPatientParams,
  GetPatientResponse,
  UpdatePatientParams,
  UpdatePatientBody,
  UpdatePatientResponse,
  ListPatientsResponse,
  ListPatientsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const patientSelect = {
  id: patientsTable.id,
  mrn: patientsTable.mrn,
  externalEhrId: patientsTable.externalEhrId,
  ehrSystem: patientsTable.ehrSystem,
  firstName: patientsTable.firstName,
  lastName: patientsTable.lastName,
  middleName: patientsTable.middleName,
  dateOfBirth: patientsTable.dateOfBirth,
  gender: patientsTable.gender,
  homeId: patientsTable.homeId,
  homeName: homesTable.name,
  admissionDate: patientsTable.admissionDate,
  dischargeDate: patientsTable.dischargeDate,
  status: patientsTable.status,
  diagnosis: patientsTable.diagnosis,
  primaryDiagnosisCode: patientsTable.primaryDiagnosisCode,
  secondaryDiagnoses: patientsTable.secondaryDiagnoses,
  emergencyContact: patientsTable.emergencyContact,
  emergencyPhone: patientsTable.emergencyPhone,
  notes: patientsTable.notes,
  allergies: patientsTable.allergies,
  weight: patientsTable.weight,
  photoUrl: patientsTable.photoUrl,
  insuranceProvider: patientsTable.insuranceProvider,
  insurancePolicyNumber: patientsTable.insurancePolicyNumber,
  insuranceGroupNumber: patientsTable.insuranceGroupNumber,
  medicaidId: patientsTable.medicaidId,
  primaryPhysician: patientsTable.primaryPhysician,
  primaryPhysicianPhone: patientsTable.primaryPhysicianPhone,
  psychiatrist: patientsTable.psychiatrist,
  psychiatristPhone: patientsTable.psychiatristPhone,
  legalGuardian: patientsTable.legalGuardian,
  legalGuardianPhone: patientsTable.legalGuardianPhone,
  advanceDirective: patientsTable.advanceDirective,
  createdAt: patientsTable.createdAt,
};

router.get("/patients", async (req, res): Promise<void> => {
  const queryParams = ListPatientsQueryParams.safeParse(req.query);

  let query = db
    .select(patientSelect)
    .from(patientsTable)
    .leftJoin(homesTable, eq(patientsTable.homeId, homesTable.id))
    .orderBy(patientsTable.lastName)
    .$dynamic();

  if (queryParams.success && queryParams.data.homeId) {
    query = query.where(eq(patientsTable.homeId, queryParams.data.homeId));
  }

  const patients = await query;
  res.json(ListPatientsResponse.parse(patients));
});

router.post("/patients", async (req, res): Promise<void> => {
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db.insert(patientsTable).values(parsed.data).returning();

  const [result] = await db
    .select(patientSelect)
    .from(patientsTable)
    .leftJoin(homesTable, eq(patientsTable.homeId, homesTable.id))
    .where(eq(patientsTable.id, patient.id));

  res.status(201).json(GetPatientResponse.parse(result));
});

router.get("/patients/:id", async (req, res): Promise<void> => {
  const params = GetPatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [patient] = await db
    .select(patientSelect)
    .from(patientsTable)
    .leftJoin(homesTable, eq(patientsTable.homeId, homesTable.id))
    .where(eq(patientsTable.id, params.data.id));

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  res.json(GetPatientResponse.parse(patient));
});

router.patch("/patients/:id", async (req, res): Promise<void> => {
  const params = UpdatePatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(patientsTable)
    .set(parsed.data)
    .where(eq(patientsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const [result] = await db
    .select(patientSelect)
    .from(patientsTable)
    .leftJoin(homesTable, eq(patientsTable.homeId, homesTable.id))
    .where(eq(patientsTable.id, updated.id));

  res.json(UpdatePatientResponse.parse(result));
});

export default router;
