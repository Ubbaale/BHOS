import { pgTable, text, serial, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { homesTable } from "./homes";
import { patientsTable } from "./patients";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  homeId: integer("home_id").references(() => homesTable.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  phone: text("phone"),
  email: text("email"),
  referralSource: text("referral_source").notNull(),
  referralSourceName: text("referral_source_name"),
  referralSourcePhone: text("referral_source_phone"),
  referralDate: timestamp("referral_date", { withTimezone: true }).notNull().defaultNow(),
  diagnosis: text("diagnosis"),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  priorityLevel: text("priority_level").notNull().default("normal"),
  status: text("status").notNull().default("inquiry"),
  stage: text("stage").notNull().default("new_lead"),
  notes: text("notes"),
  assignedTo: integer("assigned_to"),
  estimatedAdmissionDate: timestamp("estimated_admission_date", { withTimezone: true }),
  actualAdmissionDate: timestamp("actual_admission_date", { withTimezone: true }),
  denialReason: text("denial_reason"),
  convertedPatientId: integer("converted_patient_id").references(() => patientsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const intakeAssessmentsTable = pgTable("intake_assessments", {
  id: serial("id").primaryKey(),
  referralId: integer("referral_id").notNull().references(() => referralsTable.id),
  assessorName: text("assessor_name").notNull(),
  assessmentDate: timestamp("assessment_date", { withTimezone: true }).notNull().defaultNow(),
  presentingProblem: text("presenting_problem"),
  psychiatricHistory: text("psychiatric_history"),
  substanceUseHistory: text("substance_use_history"),
  medicalHistory: text("medical_history"),
  currentMedications: text("current_medications"),
  allergies: text("allergies"),
  legalStatus: text("legal_status"),
  guardianInfo: text("guardian_info"),
  functionalLevel: text("functional_level"),
  riskLevel: text("risk_level").notNull().default("low"),
  recommendedLevelOfCare: text("recommended_level_of_care"),
  admissionRecommendation: text("admission_recommendation").notNull().default("pending"),
  specialNeeds: text("special_needs"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const waitlistTable = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  referralId: integer("referral_id").notNull().references(() => referralsTable.id),
  homeId: integer("home_id").references(() => homesTable.id),
  position: integer("position").notNull(),
  priority: text("priority").notNull().default("normal"),
  reason: text("reason"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  estimatedAvailability: timestamp("estimated_availability", { withTimezone: true }),
  status: text("status").notNull().default("waiting"),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removalReason: text("removal_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referralsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referralsTable.$inferSelect;

export const insertIntakeAssessmentSchema = createInsertSchema(intakeAssessmentsTable).omit({ id: true, createdAt: true });
export type InsertIntakeAssessment = z.infer<typeof insertIntakeAssessmentSchema>;
export type IntakeAssessment = typeof intakeAssessmentsTable.$inferSelect;

export const insertWaitlistSchema = createInsertSchema(waitlistTable).omit({ id: true, createdAt: true });
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type Waitlist = typeof waitlistTable.$inferSelect;
