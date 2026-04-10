import { Router } from "express";
import { db } from "@workspace/db";
import {
  organizationsTable, subscriptionsTable, licenseEventsTable,
  homesTable, staffTable, patientsTable,
  medicationsTable, bedAssignmentsTable,
  referralsTable, treatmentPlansTable, treatmentGoalsTable,
  progressNotesTable, dischargePlansTable,
  incidentsTable, dailyLogsTable, shiftsTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const DEMO_HOMES = [
  { name: "Sunrise Behavioral Home", address: "142 Maple Street", city: "Austin", state: "TX", region: "South", capacity: 8, phone: "(512) 555-0101", licenseNumber: "TX-BH-2024-001", geofenceLatitude: "30.2672", geofenceLongitude: "-97.7431" },
  { name: "Harmony House", address: "305 Oak Avenue", city: "Austin", state: "TX", region: "South", capacity: 6, phone: "(512) 555-0102", licenseNumber: "TX-BH-2024-002", geofenceLatitude: "30.2849", geofenceLongitude: "-97.7341" },
  { name: "Serenity Gardens", address: "88 Willow Lane", city: "Round Rock", state: "TX", region: "South", capacity: 10, phone: "(512) 555-0103", licenseNumber: "TX-BH-2024-003", geofenceLatitude: "30.5083", geofenceLongitude: "-97.6789" },
];

const DEMO_STAFF = [
  { firstName: "Maria", lastName: "Gonzalez", email: "maria.gonzalez@demo.bhos.app", role: "nurse", phone: "(512) 555-1001", employeeType: "permanent" },
  { firstName: "James", lastName: "Thompson", email: "james.thompson@demo.bhos.app", role: "direct_care", phone: "(512) 555-1002", employeeType: "permanent" },
  { firstName: "Aisha", lastName: "Patel", email: "aisha.patel@demo.bhos.app", role: "direct_care", phone: "(512) 555-1003", employeeType: "permanent" },
  { firstName: "David", lastName: "Kim", email: "david.kim@demo.bhos.app", role: "nurse", phone: "(512) 555-1004", employeeType: "permanent" },
  { firstName: "Sarah", lastName: "Johnson", email: "sarah.johnson@demo.bhos.app", role: "manager", phone: "(512) 555-1005", employeeType: "permanent" },
  { firstName: "Robert", lastName: "Williams", email: "robert.williams@demo.bhos.app", role: "direct_care", phone: "(512) 555-1006", employeeType: "part_time" },
  { firstName: "Lisa", lastName: "Chen", email: "lisa.chen@demo.bhos.app", role: "nurse", phone: "(512) 555-1007", employeeType: "permanent" },
  { firstName: "Michael", lastName: "Brown", email: "michael.brown@demo.bhos.app", role: "direct_care", phone: "(512) 555-1008", employeeType: "prn" },
];

const DEMO_PATIENTS = [
  { firstName: "John", lastName: "Mitchell", dateOfBirth: "1985-03-15", gender: "male", mrn: "MRN-2024-001", diagnosis: "Bipolar I Disorder", allergies: "Penicillin", insuranceProvider: "Blue Cross Blue Shield", insurancePolicyNumber: "BCBS-9901234" },
  { firstName: "Emily", lastName: "Davis", dateOfBirth: "1992-07-22", gender: "female", mrn: "MRN-2024-002", diagnosis: "Major Depressive Disorder", allergies: "None known", insuranceProvider: "Aetna", insurancePolicyNumber: "AET-8876543" },
  { firstName: "Carlos", lastName: "Rivera", dateOfBirth: "1978-11-08", gender: "male", mrn: "MRN-2024-003", diagnosis: "Schizophrenia, Paranoid Type", allergies: "Sulfa drugs", insuranceProvider: "Medicaid", insurancePolicyNumber: "TXMD-456789" },
  { firstName: "Priya", lastName: "Sharma", dateOfBirth: "1990-01-30", gender: "female", mrn: "MRN-2024-004", diagnosis: "PTSD with Anxiety", allergies: "Latex", insuranceProvider: "UnitedHealthcare", insurancePolicyNumber: "UHC-334455" },
  { firstName: "Marcus", lastName: "Taylor", dateOfBirth: "1983-09-12", gender: "male", mrn: "MRN-2024-005", diagnosis: "Schizoaffective Disorder", allergies: "Codeine", insuranceProvider: "Cigna", insurancePolicyNumber: "CIG-221100" },
  { firstName: "Hannah", lastName: "Lee", dateOfBirth: "1995-05-19", gender: "female", mrn: "MRN-2024-006", diagnosis: "Borderline Personality Disorder", allergies: "None known", insuranceProvider: "Blue Cross Blue Shield", insurancePolicyNumber: "BCBS-7788990" },
  { firstName: "William", lastName: "Jackson", dateOfBirth: "1970-12-03", gender: "male", mrn: "MRN-2024-007", diagnosis: "Bipolar II Disorder with Substance Use", allergies: "Aspirin, Ibuprofen", insuranceProvider: "Medicare", insurancePolicyNumber: "MCR-112233" },
  { firstName: "Sofia", lastName: "Martinez", dateOfBirth: "1988-06-27", gender: "female", mrn: "MRN-2024-008", diagnosis: "Generalized Anxiety Disorder", allergies: "None known", insuranceProvider: "Aetna", insurancePolicyNumber: "AET-5544332" },
  { firstName: "Terrence", lastName: "Walker", dateOfBirth: "1975-04-14", gender: "male", mrn: "MRN-2024-009", diagnosis: "Major Depressive Disorder, Recurrent", allergies: "Shellfish (dietary)", insuranceProvider: "Medicaid", insurancePolicyNumber: "TXMD-998877" },
  { firstName: "Rachel", lastName: "Cohen", dateOfBirth: "1993-10-05", gender: "female", mrn: "MRN-2024-010", diagnosis: "OCD with Panic Disorder", allergies: "Erythromycin", insuranceProvider: "UnitedHealthcare", insurancePolicyNumber: "UHC-667788" },
];

const DEMO_MEDICATIONS = [
  { name: "Lithium Carbonate", dosage: "300mg", frequency: "twice daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00","20:00"]' },
  { name: "Sertraline (Zoloft)", dosage: "100mg", frequency: "once daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00"]' },
  { name: "Risperidone", dosage: "2mg", frequency: "twice daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00","20:00"]' },
  { name: "Lorazepam (Ativan)", dosage: "1mg", frequency: "as needed", route: "oral", medicationType: "prn" },
  { name: "Quetiapine (Seroquel)", dosage: "200mg", frequency: "at bedtime", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["21:00"]' },
  { name: "Fluoxetine (Prozac)", dosage: "20mg", frequency: "once daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00"]' },
  { name: "Valproic Acid (Depakote)", dosage: "500mg", frequency: "twice daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00","20:00"]' },
  { name: "Buspirone", dosage: "10mg", frequency: "three times daily", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["08:00","14:00","20:00"]' },
  { name: "Trazodone", dosage: "50mg", frequency: "at bedtime", route: "oral", medicationType: "scheduled", scheduleTimesJson: '["21:00"]' },
  { name: "Hydroxyzine", dosage: "25mg", frequency: "as needed", route: "oral", medicationType: "prn" },
];

router.post("/organizations/seed-demo", requireAuth, async (req, res) => {
  try {
    if (req.userId) {
      const [existingStaff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, req.userId));
      if (existingStaff) {
        return res.status(400).json({ error: "Your account is already linked to an organization. Demo data can only be seeded once." });
      }
    }

    const { companyName, planTier } = req.body;
    const orgName = companyName || "Demo Behavioral Health Co.";
    const plan = planTier || "professional";
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);
    const graceEndDate = new Date(endDate);
    graceEndDate.setDate(graceEndDate.getDate() + 15);

    const priceMap: Record<string, number> = { starter: 199, professional: 299, enterprise: 399, unlimited: 499 };

    const result = await db.transaction(async (tx) => {
      const [org] = await tx.insert(organizationsTable).values({
        name: orgName, slug, contactName: "Trial User", contactEmail: req.body.email || "trial@demo.bhos.app",
        address: "123 Demo Boulevard", city: "Austin", state: "TX", zipCode: "78701",
        planTier: plan, status: "active",
      }).returning();

      const [sub] = await tx.insert(subscriptionsTable).values({
        orgId: org.id, planType: plan, billingCycle: "monthly",
        pricePerHome: String(priceMap[plan] || 299), homeLimit: 999999,
        currentHomeCount: 3, startDate, endDate, graceEndDate,
        status: "active", autoRenew: false, nextBillingDate: endDate,
      }).returning();

      await tx.insert(licenseEventsTable).values({
        orgId: org.id, subscriptionId: sub.id, eventType: "trial_started",
        details: `14-day free trial started on ${plan} plan. Full access to all features.`,
        notificationSent: true,
      });

      const homeIds: number[] = [];
      for (const home of DEMO_HOMES) {
        const [h] = await tx.insert(homesTable).values({ ...home, orgId: org.id, status: "active" }).returning();
        homeIds.push(h.id);
      }

      const staffIds: number[] = [];
      for (let i = 0; i < DEMO_STAFF.length; i++) {
        const s = DEMO_STAFF[i];
        const homeId = homeIds[i % homeIds.length];
        const [created] = await tx.insert(staffTable).values({
          ...s, homeId, status: "active", hireDate: new Date("2024-01-15"),
        } as any).returning();
        staffIds.push(created.id);
      }

      if (req.userId) {
        await tx.update(staffTable).set({ clerkUserId: req.userId, role: "admin" }).where(eq(staffTable.id, staffIds[4]));
      }

      const patientIds: number[] = [];
      for (let i = 0; i < DEMO_PATIENTS.length; i++) {
        const p = DEMO_PATIENTS[i];
        const homeId = homeIds[i % homeIds.length];
        const [created] = await tx.insert(patientsTable).values({
          ...p, homeId, status: "active", admissionDate: new Date("2024-06-01"),
          emergencyContactName: "Emergency Contact", emergencyContactPhone: "(512) 555-9999",
        } as any).returning();
        patientIds.push(created.id);
      }

      for (let i = 0; i < patientIds.length; i++) {
        const homeId = homeIds[i % homeIds.length];
        await tx.insert(bedAssignmentsTable).values({
          homeId, patientId: patientIds[i], bedNumber: `B${i + 1}`,
          roomNumber: `R${Math.floor(i / 2) + 1}`, status: "occupied",
        });
      }

      for (let i = 0; i < patientIds.length; i++) {
        const med = DEMO_MEDICATIONS[i % DEMO_MEDICATIONS.length];
        await tx.insert(medicationsTable).values({
          ...med, patientId: patientIds[i], prescribedBy: "Dr. Smith",
          startDate: new Date("2024-06-15"), active: true,
        } as any);
        if (i < 5) {
          const med2 = DEMO_MEDICATIONS[(i + 3) % DEMO_MEDICATIONS.length];
          await tx.insert(medicationsTable).values({
            ...med2, patientId: patientIds[i], prescribedBy: "Dr. Williams",
            startDate: new Date("2024-07-01"), active: true,
          } as any);
        }
      }

      const referralData = [
        { firstName: "Alex", lastName: "Morgan", referralSource: "hospital", referralSourceName: "St. David's Medical Center", diagnosis: "Acute Psychosis", priorityLevel: "urgent", stage: "assessment", status: "active" },
        { firstName: "Jordan", lastName: "Chen", referralSource: "physician", referralSourceName: "Dr. Rebecca Torres", diagnosis: "Bipolar I, manic episode", priorityLevel: "high", stage: "insurance_verification", status: "active" },
        { firstName: "Taylor", lastName: "Brooks", referralSource: "court", referralSourceName: "Travis County Court", diagnosis: "Substance-induced psychotic disorder", priorityLevel: "normal", stage: "screening", status: "active" },
        { firstName: "Casey", lastName: "Williams", referralSource: "self", diagnosis: "Major Depression with SI history", priorityLevel: "high", stage: "new_lead", status: "inquiry" },
        { firstName: "Morgan", lastName: "Davis", referralSource: "family", referralSourceName: "Patricia Davis (mother)", diagnosis: "Schizoaffective Disorder", priorityLevel: "normal", stage: "contacted", status: "active" },
        { firstName: "Avery", lastName: "Thompson", referralSource: "insurance", referralSourceName: "Aetna Case Manager", diagnosis: "PTSD with co-morbid anxiety", priorityLevel: "normal", stage: "waitlist", status: "active" },
      ];
      for (const ref of referralData) {
        await tx.insert(referralsTable).values(ref as any);
      }

      for (let i = 0; i < 5; i++) {
        const [plan] = await tx.insert(treatmentPlansTable).values({
          patientId: patientIds[i], planType: "isp", title: `Annual ISP Review — ${DEMO_PATIENTS[i].firstName} ${DEMO_PATIENTS[i].lastName}`,
          startDate: new Date("2024-07-01"), reviewFrequency: "quarterly", diagnosis: DEMO_PATIENTS[i].diagnosis,
          presentingProblems: "Difficulty with daily living skills, mood regulation challenges, social withdrawal",
          strengths: "Motivated for recovery, strong family support, responsive to medication",
          clinicianName: "Dr. Maria Gonzalez", status: "active",
        } as any).returning();

        const domains = ["behavioral", "social", "daily_living", "emotional"];
        const goals = [
          { domain: domains[0], goalStatement: "Reduce frequency of disruptive behaviors from 5x/week to 1x/week within 90 days", priority: "high" },
          { domain: domains[1], goalStatement: "Participate in group activities at least 3 times per week", priority: "medium" },
          { domain: domains[2], goalStatement: "Complete morning hygiene routine independently 5 out of 7 days", priority: "medium" },
        ];
        for (const goal of goals) {
          await tx.insert(treatmentGoalsTable).values({
            planId: plan.id, ...goal,
            objectiveStatement: "Patient will demonstrate progress through consistent behavioral changes",
            interventions: "Staff will provide verbal prompts, positive reinforcement, and structured scheduling",
            progressPercentage: Math.floor(Math.random() * 60) + 20,
          } as any);
        }
      }

      const noteTypes = ["soap", "dap", "birp", "narrative"];
      for (let i = 0; i < 8; i++) {
        const patIdx = i % patientIds.length;
        const staffIdx = i % staffIds.length;
        const nType = noteTypes[i % noteTypes.length];
        const sessionDate = new Date();
        sessionDate.setDate(sessionDate.getDate() - (i * 2));
        const noteData: any = {
          patientId: patientIds[patIdx], staffId: staffIds[staffIdx], noteType: nType,
          sessionType: i % 3 === 0 ? "group" : "individual", sessionDate,
          duration: 45 + (i % 3) * 15, moodRating: 4 + (i % 5), riskLevel: i === 3 ? "moderate" : "low",
          signed: i < 4, signedAt: i < 4 ? new Date() : null, status: i < 4 ? "signed" : "draft",
          supervisorReview: i < 2, supervisorName: i < 2 ? "Sarah Johnson, LCSW" : null,
        };
        if (nType === "soap") {
          noteData.subjective = "Patient reports improved sleep but continued anxiety during group settings. States 'I feel better but still nervous around people.'";
          noteData.objective = "Patient appeared calm, maintained eye contact. Participated in 2 of 3 group activities. No signs of acute distress.";
          noteData.assessment = "Progress toward social engagement goals. Anxiety remains a barrier but showing improvement with current medication regimen.";
          noteData.plan = "Continue current medication. Increase group therapy exposure. Schedule follow-up in 1 week.";
        } else if (nType === "dap") {
          noteData.data = "Patient attended individual session. Discussed coping strategies for managing intrusive thoughts. Practiced deep breathing exercises.";
          noteData.assessment = "Patient demonstrates growing insight into triggers. Engagement in session was high.";
          noteData.plan = "Assign daily journaling exercise. Review progress at next session.";
        } else if (nType === "birp") {
          noteData.behavior = "Patient was cooperative throughout the session. Made appropriate eye contact and responded to questions thoughtfully.";
          noteData.intervention = "Applied CBT techniques to address negative thought patterns. Role-played social scenarios.";
          noteData.response = "Patient was receptive to interventions. Identified 3 cognitive distortions and practiced reframing.";
          noteData.plan = "Continue CBT approach. Introduce exposure hierarchy for social anxiety next session.";
        } else {
          noteData.narrative = "Met with patient for a 45-minute individual session. Patient was in good spirits and reported taking medications as prescribed. We reviewed progress on ISP goals and patient expressed satisfaction with current living arrangement. Discussed upcoming family visit and potential stressors. Patient identified coping strategies independently. No safety concerns at this time.";
        }
        await tx.insert(progressNotesTable).values(noteData);
      }

      await tx.insert(dischargePlansTable).values({
        patientId: patientIds[6], homeId: homeIds[2], dischargeType: "planned",
        plannedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        dischargeReason: "Treatment goals met — stepping down to outpatient care",
        dischargeTo: "Independent living apartment with outpatient support",
        aftercarePlan: "Weekly outpatient therapy, monthly psychiatry visits, peer support group",
        medicationTransitionPlan: "Continue current regimen. 30-day supply at discharge. Outpatient pharmacy: CVS #4521.",
        safetyPlan: "Crisis hotline: 988. Emergency contact: Patricia (sister). Coping strategies: mindfulness, walking, calling sponsor.",
        clinicianName: "Dr. Maria Gonzalez", status: "planning",
      } as any);

      const incidentData = [
        { homeId: homeIds[0], reportedBy: staffIds[0], title: "Verbal Altercation Between Residents", description: "Two residents had a verbal disagreement during dinner. Staff intervened and de-escalated. No physical contact.", severity: "low", category: "behavioral", status: "resolved" },
        { homeId: homeIds[1], reportedBy: staffIds[2], title: "Medication Refusal", description: "Patient refused evening medication stating stomach discomfort. Nurse notified, vitals taken, physician contacted.", severity: "medium", category: "medication", status: "resolved" },
        { homeId: homeIds[0], reportedBy: staffIds[1], title: "Fall in Bathroom", description: "Patient slipped in bathroom. No apparent injuries. Vital signs stable. Incident report filed per protocol.", severity: "medium", category: "injury", status: "under_review" },
      ];
      for (const inc of incidentData) {
        await tx.insert(incidentsTable).values(inc as any);
      }

      const moods = ["happy", "neutral", "anxious", "calm", "sad"];
      const appetites = ["good", "fair", "poor", "excellent"];
      const sleeps = ["good", "fair", "poor", "excellent"];
      for (let day = 0; day < 7; day++) {
        for (let p = 0; p < Math.min(patientIds.length, 6); p++) {
          const logDate = new Date();
          logDate.setDate(logDate.getDate() - day);
          await tx.insert(dailyLogsTable).values({
            patientId: patientIds[p], staffId: staffIds[p % staffIds.length], homeId: homeIds[p % homeIds.length],
            date: logDate, mood: moods[(p + day) % moods.length], appetite: appetites[(p + day) % appetites.length],
            sleep: sleeps[(p + day) % sleeps.length],
            notes: day === 0 ? "Patient had a productive day. Participated in group activities and completed assigned tasks." : null,
          } as any);
        }
      }

      for (let day = 0; day < 7; day++) {
        for (let s = 0; s < Math.min(staffIds.length, 4); s++) {
          const shiftDate = new Date();
          shiftDate.setDate(shiftDate.getDate() + day - 3);
          const isAM = s % 2 === 0;
          const start = new Date(shiftDate);
          start.setHours(isAM ? 7 : 15, 0, 0, 0);
          const end = new Date(shiftDate);
          end.setHours(isAM ? 15 : 23, 0, 0, 0);
          await tx.insert(shiftsTable).values({
            staffId: staffIds[s], homeId: homeIds[s % homeIds.length],
            startTime: start, endTime: end, status: day < 3 ? "completed" : "scheduled",
          } as any);
        }
      }

      return {
        org, subscription: sub,
        stats: {
          homes: homeIds.length, staff: staffIds.length, patients: patientIds.length,
          medications: "15+", bedAssignments: patientIds.length, referrals: referralData.length,
          treatmentPlans: 5, progressNotes: 8, dailyLogs: "42+", shifts: "28+", incidents: 3,
        },
      };
    });

    res.status(201).json({ message: "Demo data seeded successfully!", trialEndsAt: result.subscription.endDate, ...result });
  } catch (e: any) {
    console.error("Seed demo error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
