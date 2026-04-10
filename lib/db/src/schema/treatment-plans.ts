import { pgTable, text, serial, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const treatmentPlansTable = pgTable("treatment_plans", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  planType: text("plan_type").notNull().default("isp"),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  startDate: date("start_date").notNull(),
  targetEndDate: date("target_end_date"),
  actualEndDate: date("actual_end_date"),
  reviewFrequency: text("review_frequency").notNull().default("quarterly"),
  nextReviewDate: date("next_review_date"),
  lastReviewDate: date("last_review_date"),
  diagnosis: text("diagnosis"),
  presentingProblems: text("presenting_problems"),
  strengths: text("strengths"),
  barriers: text("barriers"),
  clinicianName: text("clinician_name").notNull(),
  clinicianSignature: boolean("clinician_signature").notNull().default(false),
  patientSignature: boolean("patient_signature").notNull().default(false),
  guardianSignature: boolean("guardian_signature").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const treatmentGoalsTable = pgTable("treatment_goals", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => treatmentPlansTable.id),
  domain: text("domain").notNull(),
  goalStatement: text("goal_statement").notNull(),
  objectiveStatement: text("objective_statement"),
  interventions: text("interventions"),
  targetDate: date("target_date"),
  status: text("status").notNull().default("active"),
  priority: text("priority").notNull().default("medium"),
  measurementCriteria: text("measurement_criteria"),
  baselineLevel: text("baseline_level"),
  targetLevel: text("target_level"),
  currentLevel: text("current_level"),
  progressPercentage: integer("progress_percentage").notNull().default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const goalProgressTable = pgTable("goal_progress", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => treatmentGoalsTable.id),
  recordedBy: text("recorded_by").notNull(),
  progressDate: date("progress_date").notNull(),
  progressNote: text("progress_note").notNull(),
  rating: integer("rating"),
  statusUpdate: text("status_update"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTreatmentPlanSchema = createInsertSchema(treatmentPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTreatmentPlan = z.infer<typeof insertTreatmentPlanSchema>;
export type TreatmentPlan = typeof treatmentPlansTable.$inferSelect;

export const insertTreatmentGoalSchema = createInsertSchema(treatmentGoalsTable).omit({ id: true, createdAt: true });
export type InsertTreatmentGoal = z.infer<typeof insertTreatmentGoalSchema>;
export type TreatmentGoal = typeof treatmentGoalsTable.$inferSelect;

export const insertGoalProgressSchema = createInsertSchema(goalProgressTable).omit({ id: true, createdAt: true });
export type InsertGoalProgress = z.infer<typeof insertGoalProgressSchema>;
export type GoalProgress = typeof goalProgressTable.$inferSelect;
