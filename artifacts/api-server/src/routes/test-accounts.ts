import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  organizationsTable, subscriptionsTable, licenseEventsTable,
  homesTable, staffTable, patientsTable,
  medicationsTable, bedAssignmentsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";

const router: IRouter = Router();

const TEST_ACCOUNTS = [
  {
    email: "admin@test.bhos.app",
    password: "BhosTest2024!",
    firstName: "Admin",
    lastName: "TestUser",
    role: "admin",
  },
  {
    email: "manager@test.bhos.app",
    password: "BhosTest2024!",
    firstName: "Manager",
    lastName: "TestUser",
    role: "manager",
  },
  {
    email: "nurse@test.bhos.app",
    password: "BhosTest2024!",
    firstName: "Nurse",
    lastName: "TestUser",
    role: "nurse",
  },
  {
    email: "caregiver@test.bhos.app",
    password: "BhosTest2024!",
    firstName: "Caregiver",
    lastName: "TestUser",
    role: "direct_care",
  },
];

const DEMO_HOMES = [
  { name: "Sunrise Behavioral Home", address: "142 Maple Street", city: "Austin", state: "TX", region: "South", capacity: 8, phone: "(512) 555-0101", licenseNumber: "TX-BH-TEST-001", geofenceLatitude: "30.2672", geofenceLongitude: "-97.7431" },
  { name: "Harmony House", address: "305 Oak Avenue", city: "Austin", state: "TX", region: "South", capacity: 6, phone: "(512) 555-0102", licenseNumber: "TX-BH-TEST-002", geofenceLatitude: "30.2849", geofenceLongitude: "-97.7341" },
  { name: "Serenity Gardens", address: "88 Willow Lane", city: "Round Rock", state: "TX", region: "South", capacity: 10, phone: "(512) 555-0103", licenseNumber: "TX-BH-TEST-003", geofenceLatitude: "30.5083", geofenceLongitude: "-97.6789" },
];

const DEMO_PATIENTS = [
  { firstName: "John", lastName: "Mitchell", dateOfBirth: "1985-03-15", gender: "male", mrn: "MRN-TEST-001", diagnosis: "Bipolar I Disorder", allergies: "Penicillin", insuranceProvider: "Blue Cross Blue Shield", insurancePolicyNumber: "BCBS-T001" },
  { firstName: "Emily", lastName: "Davis", dateOfBirth: "1992-07-22", gender: "female", mrn: "MRN-TEST-002", diagnosis: "Major Depressive Disorder", allergies: "None known", insuranceProvider: "Aetna", insurancePolicyNumber: "AET-T002" },
  { firstName: "Carlos", lastName: "Rivera", dateOfBirth: "1978-11-08", gender: "male", mrn: "MRN-TEST-003", diagnosis: "Schizophrenia, Paranoid Type", allergies: "Sulfa drugs", insuranceProvider: "Medicaid", insurancePolicyNumber: "TXMD-T003" },
  { firstName: "Priya", lastName: "Sharma", dateOfBirth: "1990-01-30", gender: "female", mrn: "MRN-TEST-004", diagnosis: "PTSD with Anxiety", allergies: "Latex", insuranceProvider: "UnitedHealthcare", insurancePolicyNumber: "UHC-T004" },
  { firstName: "Marcus", lastName: "Taylor", dateOfBirth: "1983-09-12", gender: "male", mrn: "MRN-TEST-005", diagnosis: "Schizoaffective Disorder", allergies: "Codeine", insuranceProvider: "Cigna", insurancePolicyNumber: "CIG-T005" },
  { firstName: "Hannah", lastName: "Lee", dateOfBirth: "1995-05-19", gender: "female", mrn: "MRN-TEST-006", diagnosis: "Borderline Personality Disorder", allergies: "None known", insuranceProvider: "Blue Cross Blue Shield", insurancePolicyNumber: "BCBS-T006" },
];

const DEMO_MEDICATIONS = [
  { name: "Lithium Carbonate", dosage: "300mg", frequency: "twice daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00","20:00"]' },
  { name: "Sertraline (Zoloft)", dosage: "100mg", frequency: "once daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00"]' },
  { name: "Risperidone", dosage: "2mg", frequency: "twice daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00","20:00"]' },
  { name: "Lorazepam (Ativan)", dosage: "1mg", frequency: "as needed", route: "oral", medicationType: "prn" },
  { name: "Quetiapine (Seroquel)", dosage: "200mg", frequency: "at bedtime", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["21:00"]' },
  { name: "Fluoxetine (Prozac)", dosage: "20mg", frequency: "once daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00"]' },
];

const EXTRA_STAFF = [
  { firstName: "Maria", lastName: "Gonzalez", email: "maria.gonzalez@test.bhos.app", role: "nurse", phone: "(512) 555-1001", employeeType: "permanent" },
  { firstName: "James", lastName: "Thompson", email: "james.thompson@test.bhos.app", role: "direct_care", phone: "(512) 555-1002", employeeType: "permanent" },
  { firstName: "Robert", lastName: "Williams", email: "robert.williams@test.bhos.app", role: "direct_care", phone: "(512) 555-1006", employeeType: "part_time" },
  { firstName: "Lisa", lastName: "Park", email: "lisa.park@test.bhos.app", role: "nurse", phone: "(512) 555-1007", employeeType: "permanent" },
];

router.post("/test-accounts/setup", async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }

  const results: any[] = [];

  try {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 365);

    const [org] = await db.insert(organizationsTable).values({
      name: "BHOS Test Organization",
      slug: "bhos-test-org",
      contactName: "Admin TestUser",
      contactEmail: "admin@test.bhos.app",
      address: "100 Test Blvd",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      planTier: "enterprise",
      status: "active",
    }).returning();

    const [sub] = await db.insert(subscriptionsTable).values({
      orgId: org.id,
      planType: "enterprise",
      billingCycle: "monthly",
      pricePerHome: "399.00",
      homeLimit: 999,
      currentHomeCount: 3,
      startDate,
      endDate,
      status: "active",
      autoRenew: true,
      nextBillingDate: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
    }).returning();

    await db.insert(licenseEventsTable).values({
      orgId: org.id,
      subscriptionId: sub.id,
      eventType: "trial_started",
      details: "Test organization created with enterprise plan.",
      notificationSent: true,
    });

    const homeIds: number[] = [];
    for (const home of DEMO_HOMES) {
      const [h] = await db.insert(homesTable).values({ ...home, orgId: org.id, status: "active" }).returning();
      homeIds.push(h.id);
    }

    for (const account of TEST_ACCOUNTS) {
      try {
        let clerkUser;
        const existingUsers = await clerkClient.users.getUserList({
          emailAddress: [account.email],
        });
        if (existingUsers.data.length > 0) {
          clerkUser = existingUsers.data[0];
        } else {
          clerkUser = await clerkClient.users.createUser({
            emailAddress: [account.email],
            password: account.password,
            firstName: account.firstName,
            lastName: account.lastName,
            skipPasswordChecks: true,
          });
        }

        const existingStaff = await db.select().from(staffTable).where(eq(staffTable.email, account.email));
        let staffRecord;
        if (existingStaff.length > 0) {
          await db.update(staffTable).set({
            clerkUserId: clerkUser.id,
            orgId: org.id,
            role: account.role,
            homeId: homeIds[0],
          }).where(eq(staffTable.id, existingStaff[0].id));
          staffRecord = { ...existingStaff[0], clerkUserId: clerkUser.id };
        } else {
          const [created] = await db.insert(staffTable).values({
            firstName: account.firstName,
            lastName: account.lastName,
            email: account.email,
            role: account.role,
            homeId: homeIds[0],
            orgId: org.id,
            clerkUserId: clerkUser.id,
            status: "active",
            employeeType: "permanent",
            hireDate: new Date("2024-01-15"),
          } as any).returning();
          staffRecord = created;
        }

        results.push({
          email: account.email,
          password: account.password,
          role: account.role,
          name: `${account.firstName} ${account.lastName}`,
          clerkUserId: clerkUser.id,
          staffId: staffRecord.id,
          status: "created",
        });
      } catch (err: any) {
        results.push({
          email: account.email,
          role: account.role,
          status: "error",
          error: err.message,
        });
      }
    }

    for (const extra of EXTRA_STAFF) {
      const existingStaff = await db.select().from(staffTable).where(eq(staffTable.email, extra.email));
      if (existingStaff.length === 0) {
        await db.insert(staffTable).values({
          ...extra,
          homeId: homeIds[Math.floor(Math.random() * homeIds.length)],
          orgId: org.id,
          status: "active",
          hireDate: new Date("2024-01-15"),
        } as any);
      }
    }

    const patientIds: number[] = [];
    for (let i = 0; i < DEMO_PATIENTS.length; i++) {
      const p = DEMO_PATIENTS[i];
      const homeId = homeIds[i % homeIds.length];
      const [created] = await db.insert(patientsTable).values({
        ...p,
        homeId,
        status: "active",
        admissionDate: new Date("2024-06-01"),
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "(512) 555-9999",
      } as any).returning();
      patientIds.push(created.id);
    }

    for (let i = 0; i < patientIds.length; i++) {
      const homeId = homeIds[i % homeIds.length];
      await db.insert(bedAssignmentsTable).values({
        homeId,
        patientId: patientIds[i],
        bedNumber: `B${i + 1}`,
        roomNumber: `R${Math.floor(i / 2) + 1}`,
        status: "occupied",
      });
    }

    for (let i = 0; i < patientIds.length; i++) {
      const med = DEMO_MEDICATIONS[i % DEMO_MEDICATIONS.length];
      await db.insert(medicationsTable).values({
        ...med,
        patientId: patientIds[i],
        prescribedBy: "Dr. Smith",
        startDate: new Date("2024-06-15"),
        active: true,
      } as any);
    }

    res.json({
      message: "Test accounts created successfully!",
      organization: { id: org.id, name: org.name },
      subscription: { id: sub.id, planType: sub.planType, status: sub.status },
      homes: homeIds.length,
      patients: patientIds.length,
      accounts: results,
    });
  } catch (e: any) {
    console.error("Test account setup error:", e);
    res.status(500).json({ error: e.message, partialResults: results });
  }
});

router.get("/test-accounts", async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }

  res.json({
    accounts: TEST_ACCOUNTS.map(a => ({
      email: a.email,
      password: a.password,
      role: a.role,
      name: `${a.firstName} ${a.lastName}`,
    })),
    note: "Use POST /api/test-accounts/setup to create these accounts. Then sign in with these credentials.",
  });
});

export default router;
