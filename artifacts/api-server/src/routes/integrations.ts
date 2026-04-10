import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  integrationSettingsTable,
  claimsTable,
  patientsTable,
  payersTable,
  billableServicesTable,
  medicationsTable,
  homesTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/integrations", async (_req, res): Promise<void> => {
  const settings = await db.select().from(integrationSettingsTable).orderBy(integrationSettingsTable.id);
  res.json(settings);
});

router.put("/integrations/:type", async (req, res): Promise<void> => {
  const { type } = req.params;
  const { enabled, config, status } = req.body;

  const updateData: any = { updatedAt: new Date() };
  if (enabled !== undefined) updateData.enabled = enabled;
  if (config !== undefined) updateData.config = config;
  if (status !== undefined) updateData.status = status;

  const [result] = await db
    .update(integrationSettingsTable)
    .set(updateData)
    .where(eq(integrationSettingsTable.integrationType, type))
    .returning();

  if (!result) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  res.json(result);
});

router.get("/integrations/fhir/Patient", async (req, res): Promise<void> => {
  const patientId = req.query.patientId ? parseInt(req.query.patientId as string, 10) : null;

  let query = db
    .select({
      id: patientsTable.id,
      mrn: patientsTable.mrn,
      externalEhrId: patientsTable.externalEhrId,
      ehrSystem: patientsTable.ehrSystem,
      firstName: patientsTable.firstName,
      lastName: patientsTable.lastName,
      middleName: patientsTable.middleName,
      dateOfBirth: patientsTable.dateOfBirth,
      gender: patientsTable.gender,
      status: patientsTable.status,
      diagnosis: patientsTable.diagnosis,
      primaryDiagnosisCode: patientsTable.primaryDiagnosisCode,
      secondaryDiagnoses: patientsTable.secondaryDiagnoses,
      allergies: patientsTable.allergies,
      insuranceProvider: patientsTable.insuranceProvider,
      insurancePolicyNumber: patientsTable.insurancePolicyNumber,
      medicaidId: patientsTable.medicaidId,
      primaryPhysician: patientsTable.primaryPhysician,
      emergencyContact: patientsTable.emergencyContact,
      emergencyPhone: patientsTable.emergencyPhone,
      admissionDate: patientsTable.admissionDate,
      homeName: homesTable.name,
    })
    .from(patientsTable)
    .leftJoin(homesTable, eq(patientsTable.homeId, homesTable.id))
    .$dynamic();

  if (patientId) {
    query = query.where(eq(patientsTable.id, patientId));
  }

  const patients = await query;

  const fhirBundle = {
    resourceType: "Bundle",
    type: patientId ? "searchset" : "searchset",
    total: patients.length,
    entry: patients.map((p) => ({
      fullUrl: `urn:uuid:patient-${p.id}`,
      resource: {
        resourceType: "Patient",
        id: p.externalEhrId || `local-${p.id}`,
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
        },
        identifier: [
          ...(p.mrn ? [{ use: "usual", type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR" }] }, value: p.mrn }] : []),
          ...(p.medicaidId ? [{ use: "official", type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MA" }] }, value: p.medicaidId }] : []),
          ...(p.insurancePolicyNumber ? [{ use: "secondary", type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "SN" }] }, value: p.insurancePolicyNumber }] : []),
        ],
        active: p.status === "active",
        name: [{
          use: "official",
          family: p.lastName,
          given: [p.firstName, ...(p.middleName ? [p.middleName] : [])],
        }],
        gender: p.gender === "male" ? "male" : p.gender === "female" ? "female" : "other",
        birthDate: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : undefined,
        contact: p.emergencyContact ? [{
          relationship: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0131", code: "C", display: "Emergency Contact" }] }],
          name: { text: p.emergencyContact },
          telecom: p.emergencyPhone ? [{ system: "phone", value: p.emergencyPhone, use: "home" }] : [],
        }] : [],
        generalPractitioner: p.primaryPhysician ? [{
          display: p.primaryPhysician,
        }] : [],
        extension: [
          ...(p.allergies ? [{ url: "http://bhos.local/fhir/allergies", valueString: p.allergies }] : []),
          ...(p.primaryDiagnosisCode ? [{
            url: "http://bhos.local/fhir/primaryDiagnosis",
            valueCoding: {
              system: "http://hl7.org/fhir/sid/icd-10-cm",
              code: p.primaryDiagnosisCode,
              display: p.diagnosis,
            },
          }] : []),
        ],
      },
    })),
  };

  res.setHeader("Content-Type", "application/fhir+json");
  res.json(fhirBundle);
});

router.get("/integrations/fhir/MedicationRequest", async (req, res): Promise<void> => {
  const patientId = req.query.patientId ? parseInt(req.query.patientId as string, 10) : null;

  let conditions = [];
  if (patientId) {
    conditions.push(eq(medicationsTable.patientId, patientId));
  }

  let query = db
    .select({
      id: medicationsTable.id,
      patientId: medicationsTable.patientId,
      patientFirstName: patientsTable.firstName,
      patientLastName: patientsTable.lastName,
      patientMrn: patientsTable.mrn,
      name: medicationsTable.name,
      dosage: medicationsTable.dosage,
      frequency: medicationsTable.frequency,
      route: medicationsTable.route,
      prescribedBy: medicationsTable.prescribedBy,
      startDate: medicationsTable.startDate,
      status: medicationsTable.status,
      isPrn: medicationsTable.isPrn,
      notes: medicationsTable.notes,
    })
    .from(medicationsTable)
    .leftJoin(patientsTable, eq(medicationsTable.patientId, patientsTable.id))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(conditions[0]);
  }

  const meds = await query;

  const fhirBundle = {
    resourceType: "Bundle",
    type: "searchset",
    total: meds.length,
    entry: meds.map((m) => ({
      fullUrl: `urn:uuid:medication-request-${m.id}`,
      resource: {
        resourceType: "MedicationRequest",
        id: `local-medrq-${m.id}`,
        status: m.status === "active" ? "active" : m.status === "discontinued" ? "stopped" : "completed",
        intent: "order",
        medicationCodeableConcept: {
          text: m.name,
        },
        subject: {
          reference: `Patient/local-${m.patientId}`,
          display: `${m.patientFirstName} ${m.patientLastName}`,
          identifier: m.patientMrn ? { value: m.patientMrn } : undefined,
        },
        requester: m.prescribedBy ? { display: m.prescribedBy } : undefined,
        dosageInstruction: [{
          text: `${m.dosage} ${m.route || "oral"} ${m.frequency}`,
          route: m.route ? {
            coding: [{
              system: "http://snomed.info/sct",
              display: m.route,
            }],
          } : undefined,
          timing: {
            code: { text: m.frequency },
          },
          doseAndRate: [{
            doseQuantity: { value: parseFloat(m.dosage || "0") || undefined, unit: "mg" },
          }],
        }],
        authoredOn: m.startDate ? new Date(m.startDate).toISOString() : undefined,
        note: m.notes ? [{ text: m.notes }] : [],
        extension: [
          ...(m.isPrn ? [{ url: "http://bhos.local/fhir/isPrn", valueBoolean: true }] : []),
        ],
      },
    })),
  };

  res.setHeader("Content-Type", "application/fhir+json");
  res.json(fhirBundle);
});

function generateEdi837Segment(claim: any, patient: any, payer: any, services: any[]): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T]/g, "").substring(0, 8);
  const timeStr = now.toISOString().replace(/[-:T]/g, "").substring(8, 12);
  const controlNum = String(claim.id).padStart(9, "0");

  const segments: string[] = [];

  segments.push(`ISA*00*          *00*          *ZZ*BHOSSENDER     *ZZ*${(payer?.payerId || "UNKNOWN").padEnd(15)}*${dateStr.substring(2)}*${timeStr}*^*00501*${controlNum}*0*P*:~`);
  segments.push(`GS*HC*BHOSSENDER*${payer?.payerId || "UNKNOWN"}*${dateStr}*${timeStr}*${claim.id}*X*005010X222A1~`);
  segments.push(`ST*837*${controlNum}*005010X222A1~`);
  segments.push(`BHT*0019*00*${claim.claimNumber || claim.id}*${dateStr}*${timeStr}*CH~`);

  segments.push(`NM1*41*2*BHOS BEHAVIORAL HEALTH*****46*BHOSPROVIDER~`);
  segments.push(`PER*IC*BILLING DEPT*TE*5555551000~`);

  segments.push(`NM1*40*2*${payer?.name || "UNKNOWN PAYER"}*****46*${payer?.payerId || "UNKNOWN"}~`);

  segments.push(`HL*1**20*1~`);
  segments.push(`NM1*85*2*BHOS BEHAVIORAL HEALTH*****XX*1234567890~`);
  segments.push(`N3*123 Main Street~`);
  segments.push(`N4*Boston*MA*02101~`);

  segments.push(`HL*2*1*22*0~`);
  segments.push(`SBR*P*18*${patient?.insurancePolicyNumber || ""}******CI~`);

  const patientName = `${patient?.lastName || "UNKNOWN"}*${patient?.firstName || "UNKNOWN"}`;
  segments.push(`NM1*IL*1*${patientName}****MI*${patient?.insurancePolicyNumber || patient?.mrn || "UNKNOWN"}~`);
  const dob = patient?.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().replace(/[-:T]/g, "").substring(0, 8) : "19900101";
  segments.push(`DMG*D8*${dob}*${patient?.gender === "male" ? "M" : "F"}~`);

  segments.push(`NM1*PR*2*${payer?.name || "UNKNOWN PAYER"}*****PI*${payer?.payerId || "UNKNOWN"}~`);

  segments.push(`CLM*${claim.claimNumber || claim.id}*${claim.totalCharged}***${claim.placeOfService || "31"}:B:1*Y*A*Y*Y~`);

  if (claim.primaryDiagnosisCode) {
    segments.push(`HI*ABK:${claim.primaryDiagnosisCode.replace(".", "")}~`);
  }

  if (claim.renderingProvider) {
    segments.push(`NM1*82*1*${claim.renderingProvider.replace("Dr. ", "").split(" ").reverse().join("*")}****XX*1234567891~`);
  }

  services.forEach((svc: any, idx: number) => {
    const svcDate = svc.serviceDate ? new Date(svc.serviceDate).toISOString().replace(/[-:T]/g, "").substring(0, 8) : dateStr;
    const cptCode = svc.cptCode || svc.hcpcsCode || "99999";
    segments.push(`SV1*HC:${cptCode}*${svc.totalCharge}*UN*${svc.units}***${claim.primaryDiagnosisCode ? "1" : ""}~`);
    segments.push(`DTP*472*D8*${svcDate}~`);
  });

  if (services.length === 0) {
    segments.push(`SV1*HC:H0019*${claim.totalCharged}*UN*1***1~`);
    const svcDate = new Date(claim.serviceStartDate).toISOString().replace(/[-:T]/g, "").substring(0, 8);
    segments.push(`DTP*472*RD8*${svcDate}-${new Date(claim.serviceEndDate).toISOString().replace(/[-:T]/g, "").substring(0, 8)}~`);
  }

  segments.push(`SE*${segments.length - 2}*${controlNum}~`);
  segments.push(`GE*1*${claim.id}~`);
  segments.push(`IEA*1*${controlNum}~`);

  return segments.join("\n");
}

router.get("/integrations/edi837/:claimId", async (req, res): Promise<void> => {
  const claimId = parseInt(req.params.claimId, 10);

  const claimResult = await db
    .select()
    .from(claimsTable)
    .where(eq(claimsTable.id, claimId));

  if (claimResult.length === 0) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }

  const claim = claimResult[0];

  const patientResult = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, claim.patientId));

  const payerResult = await db
    .select()
    .from(payersTable)
    .where(eq(payersTable.id, claim.payerId));

  const services = await db
    .select()
    .from(billableServicesTable)
    .where(eq(billableServicesTable.claimId, claimId));

  const edi = generateEdi837Segment(claim, patientResult[0], payerResult[0], services);

  if (req.query.format === "raw") {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="837P_${claim.claimNumber || claim.id}.edi"`);
    res.send(edi);
  } else {
    res.json({
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      format: "837P",
      version: "005010X222A1",
      edi,
      segments: edi.split("\n").length,
      generatedAt: new Date().toISOString(),
    });
  }
});

router.get("/integrations/edi837-batch", async (_req, res): Promise<void> => {
  const claims = await db
    .select()
    .from(claimsTable)
    .where(eq(claimsTable.status, "ready"));

  if (claims.length === 0) {
    res.json({ message: "No claims in 'ready' status for batch export", claims: [] });
    return;
  }

  const results = [];
  for (const claim of claims) {
    const patientResult = await db.select().from(patientsTable).where(eq(patientsTable.id, claim.patientId));
    const payerResult = await db.select().from(payersTable).where(eq(payersTable.id, claim.payerId));
    const services = await db.select().from(billableServicesTable).where(eq(billableServicesTable.claimId, claim.id));

    results.push({
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      edi: generateEdi837Segment(claim, patientResult[0], payerResult[0], services),
    });
  }

  res.json({ total: results.length, claims: results });
});

router.get("/integrations/medicaid/config", async (_req, res): Promise<void> => {
  const stateConfigs = [
    { state: "MA", name: "Massachusetts (MassHealth)", portalUrl: "https://newmmis.ehs.state.ma.us", submissionFormat: "837P", timely: "90 days" },
    { state: "NY", name: "New York (eMedNY)", portalUrl: "https://www.emedny.org", submissionFormat: "837P", timely: "90 days" },
    { state: "CA", name: "California (Medi-Cal)", portalUrl: "https://www.medi-cal.ca.gov", submissionFormat: "837P", timely: "180 days" },
    { state: "TX", name: "Texas (TMHP)", portalUrl: "https://www.tmhp.com", submissionFormat: "837P", timely: "95 days" },
    { state: "FL", name: "Florida (FMMIS)", portalUrl: "https://www.myflorida.com/accessflorida", submissionFormat: "837P", timely: "365 days" },
    { state: "PA", name: "Pennsylvania (PROMISe)", portalUrl: "https://www.dhs.pa.gov", submissionFormat: "837P", timely: "180 days" },
    { state: "IL", name: "Illinois (HFS)", portalUrl: "https://www.illinois.gov/hfs", submissionFormat: "837P", timely: "180 days" },
    { state: "OH", name: "Ohio (MITS)", portalUrl: "https://medicaid.ohio.gov", submissionFormat: "837P", timely: "365 days" },
  ];
  res.json(stateConfigs);
});

export default router;
