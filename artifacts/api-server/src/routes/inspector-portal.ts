import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  homesTable,
  patientsTable,
  staffTable,
  crisisEventsTable,
  crisisDebriefingsTable,
  incidentsTable,
  medicationAdministrationsTable,
  medicationErrorsTable,
  medicationsTable,
  staffCertificationsTable,
  trainingCoursesTable,
  trainingRecordsTable,
  inspectionVisitsTable,
  stateInspectorsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, gte, count } from "drizzle-orm";
import { requireInspectorAuth, logInspectorAccess } from "../middlewares/inspectorAuth";

const router = Router();

function getScopedHomeIds(inspector: NonNullable<Request["inspector"]>, orgHomeIds: number[]): number[] {
  if (inspector.accessScope && inspector.accessScope.length > 0) {
    return orgHomeIds.filter((id) => inspector.accessScope!.includes(id));
  }
  return orgHomeIds;
}

async function getOrgHomeIds(orgId: number): Promise<number[]> {
  const homes = await db.select({ id: homesTable.id }).from(homesTable).where(eq(homesTable.orgId, orgId));
  return homes.map((h) => h.id);
}

router.use(requireInspectorAuth);

router.get("/inspector/overview", async (req: Request, res: Response) => {
  const inspector = req.inspector!;
  const allHomeIds = await getOrgHomeIds(inspector.orgId);
  const homeIds = getScopedHomeIds(inspector, allHomeIds);

  await logInspectorAccess(inspector.id, inspector.orgId, "view", "overview", null, req);

  if (homeIds.length === 0) return res.json({ homes: [], patients: 0, staff: 0 });

  const homes = await db.select({ id: homesTable.id, name: homesTable.name, address: homesTable.address, capacity: homesTable.capacity, status: homesTable.status }).from(homesTable).where(inArray(homesTable.id, homeIds));

  const [patientCount] = await db.select({ cnt: count() }).from(patientsTable).where(inArray(patientsTable.homeId, homeIds));
  const [staffCount] = await db.select({ cnt: count() }).from(staffTable).where(eq(staffTable.orgId, inspector.orgId));

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [incidentCount] = await db.select({ cnt: count() }).from(incidentsTable).where(and(inArray(incidentsTable.homeId, homeIds), gte(incidentsTable.occurredAt, ninetyDaysAgo)));

  const [crisisCount] = await db.select({ cnt: count() }).from(crisisEventsTable).where(and(inArray(crisisEventsTable.homeId, homeIds), gte(crisisEventsTable.occurredAt, ninetyDaysAgo)));

  const [restraintCount] = await db.select({ cnt: count() }).from(crisisEventsTable).where(and(inArray(crisisEventsTable.homeId, homeIds), eq(crisisEventsTable.restraintUsed, true), gte(crisisEventsTable.occurredAt, ninetyDaysAgo)));

  res.json({
    homes,
    totalPatients: Number(patientCount?.cnt) || 0,
    totalStaff: Number(staffCount?.cnt) || 0,
    last90Days: {
      incidents: Number(incidentCount?.cnt) || 0,
      crisisEvents: Number(crisisCount?.cnt) || 0,
      restraintEvents: Number(restraintCount?.cnt) || 0,
    },
  });
});

router.get("/inspector/patients", async (req: Request, res: Response) => {
  const inspector = req.inspector!;
  const allHomeIds = await getOrgHomeIds(inspector.orgId);
  const homeIds = getScopedHomeIds(inspector, allHomeIds);

  await logInspectorAccess(inspector.id, inspector.orgId, "view", "patients", null, req);

  if (homeIds.length === 0) return res.json([]);

  const patients = await db
    .select({
      id: patientsTable.id,
      firstName: patientsTable.firstName,
      lastName: patientsTable.lastName,
      dateOfBirth: patientsTable.dateOfBirth,
      status: patientsTable.status,
      admissionDate: patientsTable.admissionDate,
      homeId: patientsTable.homeId,
      homeName: homesTable.name,
    })
    .from(patientsTable)
    .leftJoin(homesTable, eq(patientsTable.homeId, homesTable.id))
    .where(inArray(patientsTable.homeId, homeIds))
    .orderBy(patientsTable.lastName);

  res.json(patients);
});

router.get("/inspector/incidents", async (req: Request, res: Response) => {
  const inspector = req.inspector!;
  const allHomeIds = await getOrgHomeIds(inspector.orgId);
  const homeIds = getScopedHomeIds(inspector, allHomeIds);

  await logInspectorAccess(inspector.id, inspector.orgId, "view", "incidents", null, req);

  if (homeIds.length === 0) return res.json([]);

  const incidents = await db
    .select({
      id: incidentsTable.id,
      type: incidentsTable.category,
      severity: incidentsTable.severity,
      description: incidentsTable.description,
      status: incidentsTable.status,
      occurredAt: incidentsTable.occurredAt,
      homeId: incidentsTable.homeId,
      homeName: homesTable.name,
    })
    .from(incidentsTable)
    .leftJoin(homesTable, eq(incidentsTable.homeId, homesTable.id))
    .where(inArray(incidentsTable.homeId, homeIds))
    .orderBy(desc(incidentsTable.occurredAt))
    .limit(100);

  res.json(incidents);
});

router.get("/inspector/crisis-events", async (req: Request, res: Response) => {
  const inspector = req.inspector!;
  const allHomeIds = await getOrgHomeIds(inspector.orgId);
  const homeIds = getScopedHomeIds(inspector, allHomeIds);

  await logInspectorAccess(inspector.id, inspector.orgId, "view", "crisis_events", null, req);

  if (homeIds.length === 0) return res.json([]);

  const events = await db
    .select({
      id: crisisEventsTable.id,
      crisisType: crisisEventsTable.crisisType,
      severity: crisisEventsTable.severity,
      description: crisisEventsTable.description,
      restraintUsed: crisisEventsTable.restraintUsed,
      restraintType: crisisEventsTable.restraintType,
      restraintStartTime: crisisEventsTable.restraintStartTime,
      restraintEndTime: crisisEventsTable.restraintEndTime,
      restraintJustification: crisisEventsTable.restraintJustification,
      seclusionUsed: crisisEventsTable.seclusionUsed,
      hospitalTransport: crisisEventsTable.hospitalTransport,
      hospitalName: crisisEventsTable.hospitalName,
      outcome: crisisEventsTable.outcome,
      status: crisisEventsTable.status,
      occurredAt: crisisEventsTable.occurredAt,
      resolvedAt: crisisEventsTable.resolvedAt,
      homeId: crisisEventsTable.homeId,
      homeName: homesTable.name,
      patientFirstName: patientsTable.firstName,
      patientLastName: patientsTable.lastName,
    })
    .from(crisisEventsTable)
    .leftJoin(homesTable, eq(crisisEventsTable.homeId, homesTable.id))
    .leftJoin(patientsTable, eq(crisisEventsTable.patientId, patientsTable.id))
    .where(inArray(crisisEventsTable.homeId, homeIds))
    .orderBy(desc(crisisEventsTable.occurredAt))
    .limit(100);

  res.json(events);
});

router.get("/inspector/medication-logs", async (req: Request, res: Response) => {
  const inspector = req.inspector!;
  const allHomeIds = await getOrgHomeIds(inspector.orgId);
  const homeIds = getScopedHomeIds(inspector, allHomeIds);

  await logInspectorAccess(inspector.id, inspector.orgId, "view", "medication_logs", null, req);

  if (homeIds.length === 0) return res.json({ administrations: [], errors: [] });

  const administrations = await db
    .select({
      id: medicationAdministrationsTable.id,
      status: medicationAdministrationsTable.status,
      administeredAt: medicationAdministrationsTable.administeredAt,
      notes: medicationAdministrationsTable.notes,
      patientFirstName: patientsTable.firstName,
      patientLastName: patientsTable.lastName,
      medicationName: medicationsTable.name,
    })
    .from(medicationAdministrationsTable)
    .leftJoin(patientsTable, eq(medicationAdministrationsTable.patientId, patientsTable.id))
    .leftJoin(medicationsTable, eq(medicationAdministrationsTable.medicationId, medicationsTable.id))
    .where(inArray(patientsTable.homeId, homeIds))
    .orderBy(desc(medicationAdministrationsTable.administeredAt))
    .limit(100);

  const errors = await db
    .select({
      id: medicationErrorsTable.id,
      errorType: medicationErrorsTable.errorType,
      severity: medicationErrorsTable.severity,
      description: medicationErrorsTable.description,
      occurredAt: medicationErrorsTable.occurredAt,
      homeName: homesTable.name,
    })
    .from(medicationErrorsTable)
    .innerJoin(patientsTable, eq(medicationErrorsTable.patientId, patientsTable.id))
    .leftJoin(homesTable, eq(patientsTable.homeId, homesTable.id))
    .where(inArray(patientsTable.homeId, homeIds))
    .orderBy(desc(medicationErrorsTable.occurredAt))
    .limit(50);

  res.json({ administrations, errors });
});

router.get("/inspector/training-status", async (req: Request, res: Response) => {
  const inspector = req.inspector!;

  await logInspectorAccess(inspector.id, inspector.orgId, "view", "training_status", null, req);

  const certifications = await db
    .select({
      id: staffCertificationsTable.id,
      certificationName: staffCertificationsTable.certificationName,
      issuingOrganization: staffCertificationsTable.issuingOrganization,
      earnedDate: staffCertificationsTable.earnedDate,
      expiresAt: staffCertificationsTable.expirationDate,
      verified: staffCertificationsTable.verifiedAt,
      staffFirstName: staffTable.firstName,
      staffLastName: staffTable.lastName,
      staffRole: staffTable.role,
    })
    .from(staffCertificationsTable)
    .innerJoin(staffTable, eq(staffCertificationsTable.staffId, staffTable.id))
    .where(eq(staffTable.orgId, inspector.orgId))
    .orderBy(staffCertificationsTable.expirationDate);

  const records = await db
    .select({
      id: trainingRecordsTable.id,
      status: trainingRecordsTable.status,
      completedAt: trainingRecordsTable.completedAt,
      score: trainingRecordsTable.score,
      courseName: trainingCoursesTable.name,
      staffFirstName: staffTable.firstName,
      staffLastName: staffTable.lastName,
    })
    .from(trainingRecordsTable)
    .leftJoin(trainingCoursesTable, eq(trainingRecordsTable.courseId, trainingCoursesTable.id))
    .innerJoin(staffTable, eq(trainingRecordsTable.staffId, staffTable.id))
    .where(eq(staffTable.orgId, inspector.orgId))
    .orderBy(desc(trainingRecordsTable.completedAt))
    .limit(100);

  res.json({ certifications, trainingRecords: records });
});

router.post("/inspector/login", async (_req: Request, res: Response) => {
  res.json({ success: true, message: "Authenticated" });
});

export default router;
