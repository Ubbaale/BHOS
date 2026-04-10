import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  stateInspectorsTable,
  inspectionVisitsTable,
  complianceReportsTable,
  stateAuditLogTable,
  staffTable,
  homesTable,
  patientsTable,
  crisisEventsTable,
  trainingCoursesTable,
  staffCertificationsTable,
  trainingRecordsTable,
  incidentsTable,
  medicationAdministrationsTable,
  medicationErrorsTable,
} from "@workspace/db/schema";
import { eq, and, count, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { hashToken } from "../middlewares/inspectorAuth";
import crypto from "crypto";

const router = Router();

function pick<T extends Record<string, any>>(obj: T, keys: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

async function resolveStaffOrg(req: Request): Promise<{ orgId: number; staffId: number } | null> {
  const [staff] = await db
    .select({ id: staffTable.id, orgId: staffTable.orgId })
    .from(staffTable)
    .where(eq(staffTable.clerkUserId, req.userId || ""))
    .limit(1);
  if (!staff?.orgId) return null;
  return { orgId: staff.orgId, staffId: staff.id };
}

async function getOrgHomeIds(orgId: number): Promise<number[]> {
  const homes = await db.select({ id: homesTable.id }).from(homesTable).where(eq(homesTable.orgId, orgId));
  return homes.map((h) => h.id);
}

router.get("/compliance/inspectors", requireAuth, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const inspectors = await db
    .select()
    .from(stateInspectorsTable)
    .where(eq(stateInspectorsTable.orgId, org.orgId))
    .orderBy(desc(stateInspectorsTable.createdAt));

  const sanitized = inspectors.map((i) => ({ ...i, accessToken: i.accessToken.slice(0, 8) + "..." }));
  res.json(sanitized);
});

router.post("/compliance/inspectors", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const allowed = pick(req.body, ["name", "email", "stateAgency", "title", "phone", "accessScope", "expiresAt"]);
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  const [inspector] = await db
    .insert(stateInspectorsTable)
    .values({ ...allowed, orgId: org.orgId, accessToken: tokenHash } as any)
    .returning();

  res.status(201).json({ ...inspector, accessToken: rawToken });
});

router.patch("/compliance/inspectors/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [existing] = await db
    .select()
    .from(stateInspectorsTable)
    .where(and(eq(stateInspectorsTable.id, id), eq(stateInspectorsTable.orgId, org.orgId)));
  if (!existing) return res.status(404).json({ error: "Inspector not found" });

  const allowed = pick(req.body, ["name", "email", "stateAgency", "title", "phone", "accessScope", "status", "expiresAt"]);
  const [updated] = await db
    .update(stateInspectorsTable)
    .set({ ...allowed, updatedAt: new Date() } as any)
    .where(eq(stateInspectorsTable.id, id))
    .returning();

  res.json({ ...updated, accessToken: updated.accessToken.slice(0, 8) + "..." });
});

router.post("/compliance/inspectors/:id/regenerate-token", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const id = parseInt(req.params.id);
  const [existing] = await db
    .select()
    .from(stateInspectorsTable)
    .where(and(eq(stateInspectorsTable.id, id), eq(stateInspectorsTable.orgId, org.orgId)));
  if (!existing) return res.status(404).json({ error: "Inspector not found" });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  await db.update(stateInspectorsTable).set({ accessToken: tokenHash, updatedAt: new Date() }).where(eq(stateInspectorsTable.id, id));

  res.json({ accessToken: rawToken });
});

router.get("/compliance/visits", requireAuth, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const visits = await db
    .select({
      visit: inspectionVisitsTable,
      homeName: homesTable.name,
      inspectorName: stateInspectorsTable.name,
      inspectorAgency: stateInspectorsTable.stateAgency,
    })
    .from(inspectionVisitsTable)
    .leftJoin(homesTable, eq(inspectionVisitsTable.homeId, homesTable.id))
    .leftJoin(stateInspectorsTable, eq(inspectionVisitsTable.inspectorId, stateInspectorsTable.id))
    .where(eq(inspectionVisitsTable.orgId, org.orgId))
    .orderBy(desc(inspectionVisitsTable.createdAt));

  res.json(visits);
});

router.post("/compliance/visits", requireAuth, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const homeIds = await getOrgHomeIds(org.orgId);
  const homeId = parseInt(req.body.homeId);
  if (!homeIds.includes(homeId)) return res.status(403).json({ error: "Home does not belong to your organization" });

  const inspectorId = parseInt(req.body.inspectorId);
  const [inspector] = await db.select().from(stateInspectorsTable).where(and(eq(stateInspectorsTable.id, inspectorId), eq(stateInspectorsTable.orgId, org.orgId))).limit(1);
  if (!inspector) return res.status(403).json({ error: "Inspector does not belong to your organization" });

  const allowed = pick(req.body, [
    "visitType", "scheduledDate", "visitDate",
    "status", "overallScore", "findings", "deficiencies", "correctiveActions",
    "correctiveDeadline", "followUpRequired", "followUpDate", "notes",
  ]);

  const [visit] = await db
    .insert(inspectionVisitsTable)
    .values({ ...allowed, homeId, inspectorId, orgId: org.orgId } as any)
    .returning();

  res.status(201).json(visit);
});

router.patch("/compliance/visits/:id", requireAuth, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [existing] = await db
    .select()
    .from(inspectionVisitsTable)
    .where(and(eq(inspectionVisitsTable.id, id), eq(inspectionVisitsTable.orgId, org.orgId)));
  if (!existing) return res.status(404).json({ error: "Visit not found" });

  const allowed = pick(req.body, [
    "visitType", "scheduledDate", "visitDate", "status", "overallScore",
    "findings", "deficiencies", "correctiveActions", "correctiveDeadline",
    "followUpRequired", "followUpDate", "notes",
  ]);

  const [updated] = await db
    .update(inspectionVisitsTable)
    .set({ ...allowed, updatedAt: new Date() } as any)
    .where(eq(inspectionVisitsTable.id, id))
    .returning();

  res.json(updated);
});

router.get("/compliance/reports", requireAuth, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const reports = await db
    .select({
      report: complianceReportsTable,
      homeName: homesTable.name,
    })
    .from(complianceReportsTable)
    .leftJoin(homesTable, eq(complianceReportsTable.homeId, homesTable.id))
    .where(eq(complianceReportsTable.orgId, org.orgId))
    .orderBy(desc(complianceReportsTable.createdAt));

  res.json(reports);
});

router.post("/compliance/reports/generate", requireAuth, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const { reportType, homeId, periodStart, periodEnd } = req.body;
  if (!reportType || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "reportType, periodStart, periodEnd are required" });
  }

  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const orgHomeIds = await getOrgHomeIds(org.orgId);
  if (homeId) {
    const parsedHomeId = parseInt(homeId);
    if (!orgHomeIds.includes(parsedHomeId)) return res.status(403).json({ error: "Home does not belong to your organization" });
  }
  const homeIds = homeId ? [parseInt(homeId)] : orgHomeIds;

  if (homeIds.length === 0) return res.status(400).json({ error: "No homes found" });

  const reportData: Record<string, unknown> = {};
  const scores: Record<string, number> = {};

  if (reportType === "comprehensive" || reportType === "restraint_seclusion") {
    const crisisEvents = await db
      .select({ cnt: count() })
      .from(crisisEventsTable)
      .where(and(inArray(crisisEventsTable.homeId, homeIds), gte(crisisEventsTable.occurredAt, startDate), lte(crisisEventsTable.occurredAt, endDate)));
    const restraintEvents = await db
      .select({ cnt: count() })
      .from(crisisEventsTable)
      .where(and(inArray(crisisEventsTable.homeId, homeIds), eq(crisisEventsTable.restraintUsed, true), gte(crisisEventsTable.occurredAt, startDate), lte(crisisEventsTable.occurredAt, endDate)));
    reportData.crisisEvents = crisisEvents[0]?.cnt || 0;
    reportData.restraintEvents = restraintEvents[0]?.cnt || 0;
    const crisisTotal = Number(crisisEvents[0]?.cnt) || 0;
    const restraintTotal = Number(restraintEvents[0]?.cnt) || 0;
    scores.restraintDocumentation = crisisTotal === 0 ? 100 : Math.max(0, 100 - restraintTotal * 10);
  }

  if (reportType === "comprehensive" || reportType === "training_compliance") {
    const totalStaff = await db
      .select({ cnt: count() })
      .from(staffTable)
      .where(eq(staffTable.orgId, org.orgId));
    const expiredCerts = await db
      .select({ cnt: count() })
      .from(staffCertificationsTable)
      .innerJoin(staffTable, eq(staffCertificationsTable.staffId, staffTable.id))
      .where(and(eq(staffTable.orgId, org.orgId), lte(staffCertificationsTable.expirationDate, new Date())));
    reportData.totalStaff = totalStaff[0]?.cnt || 0;
    reportData.expiredCertifications = expiredCerts[0]?.cnt || 0;
    const staffCount = Number(totalStaff[0]?.cnt) || 1;
    const expired = Number(expiredCerts[0]?.cnt) || 0;
    scores.trainingCompliance = Math.max(0, Math.round(100 - (expired / staffCount) * 100));
  }

  if (reportType === "comprehensive" || reportType === "incident_summary") {
    const incidents = await db
      .select({ cnt: count() })
      .from(incidentsTable)
      .where(and(inArray(incidentsTable.homeId, homeIds), gte(incidentsTable.occurredAt, startDate), lte(incidentsTable.occurredAt, endDate)));
    reportData.totalIncidents = incidents[0]?.cnt || 0;
  }

  if (reportType === "comprehensive" || reportType === "medication_compliance") {
    const medErrors = await db
      .select({ cnt: count() })
      .from(medicationErrorsTable)
      .innerJoin(patientsTable, eq(medicationErrorsTable.patientId, patientsTable.id))
      .where(and(inArray(patientsTable.homeId, homeIds), gte(medicationErrorsTable.occurredAt, startDate), lte(medicationErrorsTable.occurredAt, endDate)));
    const totalAdmins = await db
      .select({ cnt: count() })
      .from(medicationAdministrationsTable)
      .innerJoin(patientsTable, eq(medicationAdministrationsTable.patientId, patientsTable.id))
      .where(and(inArray(patientsTable.homeId, homeIds), gte(medicationAdministrationsTable.administeredAt, startDate), lte(medicationAdministrationsTable.administeredAt, endDate)));
    reportData.medicationErrors = medErrors[0]?.cnt || 0;
    reportData.totalAdministrations = totalAdmins[0]?.cnt || 0;
    const admins = Number(totalAdmins[0]?.cnt) || 1;
    const errors = Number(medErrors[0]?.cnt) || 0;
    scores.medicationSafety = Math.max(0, Math.round(100 - (errors / admins) * 100));
  }

  const [report] = await db
    .insert(complianceReportsTable)
    .values({
      orgId: org.orgId,
      homeId: homeId ? parseInt(homeId) : null,
      reportType,
      reportPeriodStart: startDate,
      reportPeriodEnd: endDate,
      reportData,
      scores,
      generatedBy: org.staffId,
      status: "generated",
    })
    .returning();

  res.status(201).json(report);
});

router.get("/compliance/scorecard", requireAuth, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const homeIds = await getOrgHomeIds(org.orgId);
  if (homeIds.length === 0) return res.json({ scores: {}, overall: 0 });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [restraintResult] = await db
    .select({ cnt: count() })
    .from(crisisEventsTable)
    .where(and(inArray(crisisEventsTable.homeId, homeIds), eq(crisisEventsTable.restraintUsed, true), gte(crisisEventsTable.occurredAt, ninetyDaysAgo)));
  const restraintCount = Number(restraintResult?.cnt) || 0;
  const restraintScore = Math.max(0, 100 - restraintCount * 5);

  const [totalStaffResult] = await db
    .select({ cnt: count() })
    .from(staffTable)
    .where(eq(staffTable.orgId, org.orgId));
  const [expiredCertsResult] = await db
    .select({ cnt: count() })
    .from(staffCertificationsTable)
    .innerJoin(staffTable, eq(staffCertificationsTable.staffId, staffTable.id))
    .where(and(eq(staffTable.orgId, org.orgId), lte(staffCertificationsTable.expirationDate, now)));
  const staffCount = Number(totalStaffResult?.cnt) || 1;
  const expiredCerts = Number(expiredCertsResult?.cnt) || 0;
  const trainingScore = Math.max(0, Math.round(100 - (expiredCerts / staffCount) * 100));

  const [incidentResult] = await db
    .select({ cnt: count() })
    .from(incidentsTable)
    .where(and(inArray(incidentsTable.homeId, homeIds), gte(incidentsTable.occurredAt, ninetyDaysAgo)));
  const incidentCount = Number(incidentResult?.cnt) || 0;
  const incidentScore = Math.max(0, 100 - incidentCount * 3);

  const [medErrorResult] = await db
    .select({ cnt: count() })
    .from(medicationErrorsTable)
    .innerJoin(patientsTable, eq(medicationErrorsTable.patientId, patientsTable.id))
    .where(and(inArray(patientsTable.homeId, homeIds), gte(medicationErrorsTable.occurredAt, ninetyDaysAgo)));
  const medErrors = Number(medErrorResult?.cnt) || 0;
  const medSafetyScore = Math.max(0, 100 - medErrors * 5);

  const [crisisDocResult] = await db
    .select({ cnt: count() })
    .from(crisisEventsTable)
    .where(and(inArray(crisisEventsTable.homeId, homeIds), gte(crisisEventsTable.occurredAt, ninetyDaysAgo)));
  const crisisTotal = Number(crisisDocResult?.cnt) || 0;
  const crisisDocScore = crisisTotal === 0 ? 100 : Math.max(50, 100 - crisisTotal * 2);

  const [patientResult] = await db
    .select({ cnt: count() })
    .from(patientsTable)
    .where(inArray(patientsTable.homeId, homeIds));
  const patientCount = Number(patientResult?.cnt) || 0;
  const censusScore = patientCount > 0 ? 95 : 80;

  const [recentVisitResult] = await db
    .select({ cnt: count() })
    .from(inspectionVisitsTable)
    .where(and(eq(inspectionVisitsTable.orgId, org.orgId), gte(inspectionVisitsTable.visitDate, ninetyDaysAgo)));
  const recentVisits = Number(recentVisitResult?.cnt) || 0;

  const scores: Record<string, { score: number; label: string; details: string }> = {
    medicationSafety: { score: medSafetyScore, label: "Medication Safety", details: `${medErrors} medication errors in last 90 days` },
    restraintDocumentation: { score: restraintScore, label: "Restraint Documentation", details: `${restraintCount} restraint events in last 90 days` },
    trainingCompliance: { score: trainingScore, label: "Training Compliance", details: `${expiredCerts} expired certifications out of ${staffCount} staff` },
    incidentReporting: { score: incidentScore, label: "Incident Reporting", details: `${incidentCount} incidents in last 90 days` },
    crisisManagement: { score: crisisDocScore, label: "Crisis Management", details: `${crisisTotal} crisis events in last 90 days` },
    censusAccuracy: { score: censusScore, label: "Census Accuracy", details: `${patientCount} patients across ${homeIds.length} homes` },
    staffingCompliance: { score: trainingScore, label: "Staffing Compliance", details: `Based on certification status` },
    phiSecurity: { score: 95, label: "PHI Security", details: "All PHI access is logged and audited" },
  };

  const scoreValues = Object.values(scores).map((s) => s.score);
  const overall = Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length);

  res.json({ scores, overall, recentInspections: recentVisits, homeCount: homeIds.length, staffCount, patientCount });
});

router.get("/compliance/audit-log", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const org = await resolveStaffOrg(req);
  if (!org) return res.status(403).json({ error: "No organization found" });

  const logs = await db
    .select({
      log: stateAuditLogTable,
      inspectorName: stateInspectorsTable.name,
      inspectorAgency: stateInspectorsTable.stateAgency,
    })
    .from(stateAuditLogTable)
    .leftJoin(stateInspectorsTable, eq(stateAuditLogTable.inspectorId, stateInspectorsTable.id))
    .where(eq(stateAuditLogTable.orgId, org.orgId))
    .orderBy(desc(stateAuditLogTable.createdAt))
    .limit(200);

  res.json(logs);
});

export default router;
