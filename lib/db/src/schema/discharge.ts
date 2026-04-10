import { pgTable, text, serial, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { homesTable } from "./homes";

export const dischargePlansTable = pgTable("discharge_plans", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  status: text("status").notNull().default("planning"),
  dischargeType: text("discharge_type").notNull().default("planned"),
  plannedDate: date("planned_date"),
  actualDate: date("actual_date"),
  dischargeReason: text("discharge_reason"),
  dischargeTo: text("discharge_to"),
  dischargeAddress: text("discharge_address"),
  aftercarePlan: text("aftercare_plan"),
  medicationTransitionPlan: text("medication_transition_plan"),
  followUpProviders: text("follow_up_providers"),
  communityResources: text("community_resources"),
  safetyPlan: text("safety_plan"),
  transportationArranged: boolean("transportation_arranged").notNull().default(false),
  housingSecured: boolean("housing_secured").notNull().default(false),
  insuranceContinuity: boolean("insurance_continuity").notNull().default(false),
  belongingsReturned: boolean("belongings_returned").notNull().default(false),
  finalAssessmentCompleted: boolean("final_assessment_completed").notNull().default(false),
  consentForReleaseObtained: boolean("consent_for_release_obtained").notNull().default(false),
  dischargeSummary: text("discharge_summary"),
  clinicianName: text("clinician_name"),
  clinicianSignedAt: timestamp("clinician_signed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aftercareFollowupsTable = pgTable("aftercare_followups", {
  id: serial("id").primaryKey(),
  dischargePlanId: integer("discharge_plan_id").notNull().references(() => dischargePlansTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  followUpType: text("follow_up_type").notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  completedDate: date("completed_date"),
  contactMethod: text("contact_method").notNull().default("phone"),
  contactedBy: text("contacted_by"),
  outcome: text("outcome"),
  patientStatus: text("patient_status"),
  currentLiving: text("current_living"),
  medicationAdherence: text("medication_adherence"),
  followingUpWithProviders: boolean("following_up_with_providers"),
  concerns: text("concerns"),
  actionItems: text("action_items"),
  nextFollowUpDate: date("next_follow_up_date"),
  status: text("status").notNull().default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDischargePlanSchema = createInsertSchema(dischargePlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDischargePlan = z.infer<typeof insertDischargePlanSchema>;
export type DischargePlan = typeof dischargePlansTable.$inferSelect;

export const insertAftercareFollowupSchema = createInsertSchema(aftercareFollowupsTable).omit({ id: true, createdAt: true });
export type InsertAftercareFollowup = z.infer<typeof insertAftercareFollowupSchema>;
export type AftercareFollowup = typeof aftercareFollowupsTable.$inferSelect;
