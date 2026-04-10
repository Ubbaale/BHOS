import { db, homesTable, staffTable, patientsTable, medicationsTable, medicationAdministrationsTable, incidentsTable, dailyLogsTable, shiftsTable, medicationSideEffectsTable, medicationRefusalsTable, medicationAuditLogTable, vitalSignsTable, payersTable, billableServicesTable, claimsTable, paymentsTable, integrationSettingsTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  const [h1] = await db.insert(homesTable).values({
    name: "Sunrise Haven",
    address: "142 Maple Ave",
    city: "Boston",
    state: "MA",
    region: "Northeast",
    capacity: 12,
    currentOccupancy: 8,
    status: "active",
    phone: "(617) 555-0101",
  }).returning();

  const [h2] = await db.insert(homesTable).values({
    name: "Harmony House",
    address: "89 Oak Street",
    city: "Dallas",
    state: "TX",
    region: "South",
    capacity: 10,
    currentOccupancy: 7,
    status: "active",
    phone: "(214) 555-0202",
  }).returning();

  const [h3] = await db.insert(homesTable).values({
    name: "Serenity Gardens",
    address: "310 Pine Blvd",
    city: "Miami",
    state: "FL",
    region: "Southeast",
    capacity: 15,
    currentOccupancy: 11,
    status: "active",
    phone: "(305) 555-0303",
  }).returning();

  const [s1] = await db.insert(staffTable).values({
    firstName: "Sarah",
    lastName: "Mitchell",
    email: "sarah.mitchell@bhos.com",
    phone: "(617) 555-1001",
    role: "manager",
    homeId: h1.id,
    status: "active",
    hireDate: new Date("2022-03-15"),
  }).returning();

  const [s2] = await db.insert(staffTable).values({
    firstName: "James",
    lastName: "Rodriguez",
    email: "james.rodriguez@bhos.com",
    phone: "(214) 555-1002",
    role: "nurse",
    homeId: h2.id,
    status: "active",
    hireDate: new Date("2023-01-10"),
  }).returning();

  const [s3] = await db.insert(staffTable).values({
    firstName: "Lisa",
    lastName: "Chen",
    email: "lisa.chen@bhos.com",
    phone: "(305) 555-1003",
    role: "caregiver",
    homeId: h3.id,
    status: "active",
    hireDate: new Date("2023-06-20"),
  }).returning();

  const [p1] = await db.insert(patientsTable).values({
    firstName: "Michael",
    lastName: "Thompson",
    dateOfBirth: new Date("1985-07-22"),
    gender: "male",
    homeId: h1.id,
    admissionDate: new Date("2024-01-15"),
    status: "active",
    diagnosis: "Bipolar Disorder Type II",
    primaryDiagnosisCode: "F31.81",
    mrn: "MRN-2024-001",
    externalEhrId: "EHR-PT-10042",
    ehrSystem: "Epic",
    allergies: "Penicillin, Sulfa",
    weight: "185",
    insuranceProvider: "Blue Cross Blue Shield",
    insurancePolicyNumber: "BCBS-449281",
    insuranceGroupNumber: "GRP-8820",
    primaryPhysician: "Dr. Anderson",
    primaryPhysicianPhone: "(617) 555-4001",
    psychiatrist: "Dr. Patel",
    psychiatristPhone: "(617) 555-4002",
    emergencyContact: "Karen Thompson",
    emergencyPhone: "(617) 555-2001",
  }).returning();

  const [p2] = await db.insert(patientsTable).values({
    firstName: "Emily",
    lastName: "Davis",
    dateOfBirth: new Date("1990-03-14"),
    gender: "female",
    homeId: h2.id,
    admissionDate: new Date("2024-03-01"),
    status: "active",
    diagnosis: "Major Depressive Disorder",
    primaryDiagnosisCode: "F33.1",
    mrn: "MRN-2024-002",
    externalEhrId: "EHR-PT-10098",
    ehrSystem: "Epic",
    allergies: "None known",
    weight: "140",
    insuranceProvider: "Aetna",
    insurancePolicyNumber: "AET-773019",
    insuranceGroupNumber: "GRP-5510",
    primaryPhysician: "Dr. Martinez",
    primaryPhysicianPhone: "(214) 555-4003",
    psychiatrist: "Dr. Lee",
    psychiatristPhone: "(214) 555-4004",
    emergencyContact: "Robert Davis",
    emergencyPhone: "(214) 555-2002",
  }).returning();

  const [p3] = await db.insert(patientsTable).values({
    firstName: "David",
    lastName: "Wilson",
    dateOfBirth: new Date("1978-11-30"),
    gender: "male",
    homeId: h3.id,
    admissionDate: new Date("2024-02-10"),
    status: "active",
    diagnosis: "PTSD with Anxiety",
    primaryDiagnosisCode: "F43.10",
    mrn: "MRN-2024-003",
    externalEhrId: "EHR-PT-10155",
    ehrSystem: "Epic",
    allergies: "Aspirin",
    weight: "175",
    insuranceProvider: "United Healthcare",
    insurancePolicyNumber: "UHC-992847",
    insuranceGroupNumber: "GRP-3301",
    medicaidId: "FL-MCD-88214",
    primaryPhysician: "Dr. Kim",
    primaryPhysicianPhone: "(305) 555-4005",
    psychiatrist: "Dr. Nguyen",
    psychiatristPhone: "(305) 555-4006",
    emergencyContact: "Susan Wilson",
    emergencyPhone: "(305) 555-2003",
  }).returning();

  const now = new Date();

  const [m1] = await db.insert(medicationsTable).values({
    patientId: p1.id,
    name: "Lithium Carbonate",
    dosage: "300mg",
    frequency: "Twice daily",
    route: "oral",
    prescribedBy: "Dr. Anderson",
    startDate: new Date("2024-01-15"),
    quantityOnHand: 28,
    refillThreshold: 10,
    pharmacyName: "CVS Pharmacy",
    pharmacyPhone: "(617) 555-3001",
    rxNumber: "RX-7842901",
    lotNumber: "LOT-2024-A8821",
    expirationDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    scheduleTimesJson: JSON.stringify(["08:00", "20:00"]),
  }).returning();

  const [m2] = await db.insert(medicationsTable).values({
    patientId: p2.id,
    name: "Sertraline",
    dosage: "100mg",
    frequency: "Once daily",
    route: "oral",
    prescribedBy: "Dr. Martinez",
    startDate: new Date("2024-03-01"),
    quantityOnHand: 45,
    refillThreshold: 14,
    pharmacyName: "Walgreens",
    pharmacyPhone: "(214) 555-3002",
    rxNumber: "RX-9910345",
    lotNumber: "LOT-2025-B1190",
    expirationDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
    scheduleTimesJson: JSON.stringify(["08:00"]),
  }).returning();

  const [m3] = await db.insert(medicationsTable).values({
    patientId: p3.id,
    name: "Prazosin",
    dosage: "2mg",
    frequency: "At bedtime",
    route: "oral",
    prescribedBy: "Dr. Kim",
    startDate: new Date("2024-02-10"),
    quantityOnHand: 5,
    refillThreshold: 10,
    pharmacyName: "Rite Aid",
    pharmacyPhone: "(305) 555-3003",
    rxNumber: "RX-6650118",
    lotNumber: "LOT-2024-C3347",
    expirationDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    scheduleTimesJson: JSON.stringify(["21:00"]),
  }).returning();

  await db.insert(medicationsTable).values({
    patientId: p1.id,
    name: "Lorazepam",
    dosage: "0.5mg",
    frequency: "As needed",
    route: "oral",
    prescribedBy: "Dr. Anderson",
    startDate: new Date("2024-01-15"),
    medicationType: "prn",
    controlledSubstance: true,
    deaSchedule: "Schedule IV",
    quantityOnHand: 12,
    refillThreshold: 5,
    pharmacyName: "CVS Pharmacy",
    pharmacyPhone: "(617) 555-3001",
    rxNumber: "RX-7842999",
    lotNumber: "LOT-2025-D5501",
    expirationDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
    instructions: "Take 0.5mg for acute anxiety. Max 2mg/day. Monitor for sedation.",
  });

  await db.insert(medicationAdministrationsTable).values([
    { medicationId: m1.id, patientId: p1.id, staffId: s1.id, status: "given", administeredAt: new Date() },
    { medicationId: m2.id, patientId: p2.id, staffId: s2.id, status: "given", administeredAt: new Date() },
    { medicationId: m3.id, patientId: p3.id, staffId: s3.id, status: "missed", notes: "Patient was asleep", administeredAt: new Date() },
  ]);

  await db.insert(incidentsTable).values([
    {
      homeId: h1.id,
      patientId: p1.id,
      reportedBy: s1.id,
      title: "Verbal altercation between residents",
      description: "Two residents had a verbal argument in the common area during lunch. Staff intervened and de-escalated the situation.",
      severity: "medium",
      category: "behavioral",
      status: "investigating",
      occurredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      homeId: h3.id,
      patientId: p3.id,
      reportedBy: s3.id,
      title: "Missed medication dose",
      description: "Patient refused evening medication. Will attempt again in 30 minutes.",
      severity: "low",
      category: "medication",
      status: "open",
      occurredAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
  ]);

  await db.insert(dailyLogsTable).values([
    {
      patientId: p1.id,
      staffId: s1.id,
      homeId: h1.id,
      date: new Date(),
      mood: "good",
      appetite: "good",
      sleep: "fair",
      activities: "Participated in group therapy, walked in the garden",
      behaviors: "Cooperative throughout the day",
      notes: "Showed improvement in social interactions",
    },
    {
      patientId: p2.id,
      staffId: s2.id,
      homeId: h2.id,
      date: new Date(),
      mood: "fair",
      appetite: "poor",
      sleep: "poor",
      activities: "Attended art therapy session",
      behaviors: "Withdrawn but compliant",
      notes: "Monitor appetite over next few days",
    },
  ]);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await db.insert(shiftsTable).values([
    {
      staffId: s1.id,
      homeId: h1.id,
      startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0),
      endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0),
      status: "in_progress",
    },
    {
      staffId: s2.id,
      homeId: h2.id,
      startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0),
      endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0),
      status: "scheduled",
    },
    {
      staffId: s3.id,
      homeId: h3.id,
      startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0),
      endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0),
      status: "in_progress",
    },
  ]);

  await db.insert(medicationSideEffectsTable).values([
    {
      medicationId: m1.id,
      patientId: p1.id,
      staffId: s1.id,
      sideEffect: "Mild tremor in hands",
      severity: "mild",
      onsetTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      resolved: true,
      resolvedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      notes: "Tremor subsided after resting",
    },
    {
      medicationId: m2.id,
      patientId: p2.id,
      staffId: s2.id,
      sideEffect: "Nausea after dose",
      severity: "moderate",
      onsetTime: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      resolved: false,
      notes: "Patient reports ongoing nausea; monitoring",
    },
  ]);

  await db.insert(medicationRefusalsTable).values([
    {
      medicationId: m3.id,
      patientId: p3.id,
      staffId: s3.id,
      scheduledTime: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      reason: "Patient states medication makes them drowsy during the day",
      physicianNotified: true,
      physicianNotifiedAt: new Date(now.getTime() - 3.5 * 60 * 60 * 1000),
      physicianName: "Dr. Kim",
      followUpAction: "Physician changed dosing to bedtime only",
    },
  ]);

  await db.insert(medicationAuditLogTable).values([
    {
      entityType: "medication_administration",
      entityId: 1,
      action: "administered",
      performedBy: s1.id,
      performedByName: "Sarah Mitchell",
      details: "Lithium Carbonate 300mg administered to Michael Thompson",
    },
    {
      entityType: "medication",
      entityId: m1.id,
      action: "count_decremented",
      performedBy: s1.id,
      performedByName: "Sarah Mitchell",
      details: "Quantity on hand decremented from 30 to 29 after administration",
      previousValue: "30",
      newValue: "29",
    },
    {
      entityType: "medication_administration",
      entityId: 3,
      action: "refused",
      performedBy: s3.id,
      performedByName: "Lisa Chen",
      details: "David Wilson refused Prazosin 2mg — reason: daytime drowsiness",
    },
  ]);

  await db.insert(vitalSignsTable).values([
    {
      patientId: p1.id,
      staffId: s1.id,
      systolicBp: 128,
      diastolicBp: 82,
      heartRate: 76,
      temperature: "98.6",
      respiratoryRate: 16,
      oxygenSaturation: 97,
      recordedAt: new Date(),
    },
    {
      patientId: p2.id,
      staffId: s2.id,
      systolicBp: 118,
      diastolicBp: 74,
      heartRate: 68,
      temperature: "98.2",
      respiratoryRate: 14,
      oxygenSaturation: 99,
      recordedAt: new Date(),
    },
  ]);

  const [payer1] = await db.insert(payersTable).values({
    name: "Blue Cross Blue Shield",
    payerId: "BCBS-001",
    type: "commercial",
    phone: "(800) 262-2583",
    address: "225 N Michigan Ave, Chicago, IL 60601",
  }).returning();
  const [payer2] = await db.insert(payersTable).values({
    name: "Massachusetts Medicaid (MassHealth)",
    payerId: "MASSHEAL",
    type: "medicaid",
    phone: "(800) 841-2900",
    address: "1 Ashburton Place, Boston, MA 02108",
  }).returning();
  const [payer3] = await db.insert(payersTable).values({
    name: "Aetna Behavioral Health",
    payerId: "AET-BH-001",
    type: "commercial",
    phone: "(888) 632-3862",
    address: "151 Farmington Ave, Hartford, CT 06156",
  }).returning();
  const [payer4] = await db.insert(payersTable).values({
    name: "United Healthcare",
    payerId: "UHC-001",
    type: "commercial",
    phone: "(866) 633-2446",
    address: "9900 Bren Road East, Minnetonka, MN 55343",
  }).returning();
  const [payer5] = await db.insert(payersTable).values({
    name: "Medicare Part B",
    payerId: "MCR-001",
    type: "medicare",
    phone: "(800) 633-4227",
    address: "CMS, 7500 Security Blvd, Baltimore, MD 21244",
  }).returning();

  await db.insert(billableServicesTable).values([
    { patientId: p1.id, serviceDate: now, serviceType: "individual_therapy", cptCode: "90834", description: "Individual Psychotherapy (45 min)", units: "1", unitRate: "150.00", totalCharge: "150.00", diagnosisCode: "F31.81", status: "billed" },
    { patientId: p2.id, serviceDate: now, serviceType: "group_therapy", cptCode: "90853", description: "Group Psychotherapy", units: "1", unitRate: "80.00", totalCharge: "80.00", diagnosisCode: "F33.1", status: "billed" },
    { patientId: p3.id, serviceDate: now, serviceType: "residential", cptCode: "H0019", description: "Behavioral Health Residential (per diem)", units: "1", unitRate: "350.00", totalCharge: "350.00", diagnosisCode: "F43.10", status: "unbilled" },
    { patientId: p1.id, serviceDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), serviceType: "office_visit", cptCode: "99213", description: "Office Visit (Est. Patient, Low)", units: "1", unitRate: "120.00", totalCharge: "120.00", diagnosisCode: "F31.81", status: "billed" },
    { patientId: p2.id, serviceDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), serviceType: "individual_therapy", cptCode: "90834", description: "Individual Psychotherapy (45 min)", units: "1", unitRate: "150.00", totalCharge: "150.00", diagnosisCode: "F33.1", status: "unbilled" },
  ]);

  const claimRows = await db.insert(claimsTable).values([
    {
      payerId: payer1.id, patientId: p1.id, claimNumber: "CLM-2026-001",
      serviceStartDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      serviceEndDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      totalCharged: "750.00", totalPaid: "600.00", status: "paid",
      primaryDiagnosisCode: "F31.81",
    },
    {
      payerId: payer2.id, patientId: p3.id, claimNumber: "CLM-2026-002",
      serviceStartDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      serviceEndDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      totalCharged: "4900.00", totalPaid: "0.00", status: "submitted",
      primaryDiagnosisCode: "F43.10",
    },
    {
      payerId: payer3.id, patientId: p2.id, claimNumber: "CLM-2026-003",
      serviceStartDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      serviceEndDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      totalCharged: "310.00", totalPaid: "0.00", status: "denied",
      primaryDiagnosisCode: "F33.1",
      denialReason: "Missing prior authorization",
    },
    {
      payerId: payer4.id, patientId: p1.id, claimNumber: "CLM-2026-004",
      serviceStartDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      serviceEndDate: now,
      totalCharged: "1200.00", totalPaid: "0.00", status: "draft",
      primaryDiagnosisCode: "F31.81",
    },
    {
      payerId: payer1.id, patientId: p2.id, claimNumber: "CLM-2026-005",
      serviceStartDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      serviceEndDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      totalCharged: "480.00", totalPaid: "384.00", status: "paid",
      primaryDiagnosisCode: "F33.1",
    },
    {
      payerId: payer5.id, patientId: p3.id, claimNumber: "CLM-2026-006",
      serviceStartDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      serviceEndDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      totalCharged: "5250.00", totalPaid: "4200.00", status: "paid",
      primaryDiagnosisCode: "F43.10",
    },
  ]).returning();

  await db.insert(paymentsTable).values([
    {
      payerId: payer1.id, claimId: claimRows[0].id, amount: "600.00", paymentDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      paymentMethod: "eft", eftTraceNumber: "EFT-789012",
    },
    {
      payerId: payer1.id, claimId: claimRows[4].id, amount: "384.00", paymentDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      paymentMethod: "eft", eftTraceNumber: "EFT-654321",
    },
    {
      payerId: payer5.id, claimId: claimRows[5].id, amount: "4200.00", paymentDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      paymentMethod: "eft", eftTraceNumber: "EFT-112233",
    },
  ]);

  await db.insert(integrationSettingsTable).values([
    { integrationType: "clearinghouse", status: "active", enabled: true, config: { provider: "Availity", submissionMode: "electronic" } },
    { integrationType: "medicaid", status: "active", enabled: true, config: { state: "MA", portalUrl: "https://newmmis.ehs.state.ma.us" } },
    { integrationType: "payments", status: "disconnected", enabled: false, config: { provider: "Stripe", connected: false } },
    { integrationType: "ehr", status: "active", enabled: true, config: { system: "Epic", fhirVersion: "R4" } },
  ]);

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
