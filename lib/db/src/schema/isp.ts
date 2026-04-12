import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";

export const ispPlansTable = pgTable("isp_plans", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  title: text("title").notNull(),
  planType: text("plan_type").notNull().default("individual_service_plan"),
  status: text("status").notNull().default("draft"),
  effectiveDate: timestamp("effective_date", { withTimezone: true }),
  reviewDate: timestamp("review_date", { withTimezone: true }),
  expirationDate: timestamp("expiration_date", { withTimezone: true }),
  approvedBy: integer("approved_by").references(() => staffTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => staffTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ispGoalsTable = pgTable("isp_goals", {
  id: serial("id").primaryKey(),
  ispId: integer("isp_id").notNull().references(() => ispPlansTable.id),
  domain: text("domain").notNull(),
  goalStatement: text("goal_statement").notNull(),
  baselineBehavior: text("baseline_behavior"),
  targetBehavior: text("target_behavior"),
  measurementMethod: text("measurement_method"),
  targetDate: timestamp("target_date", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  priority: integer("priority").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ispObjectivesTable = pgTable("isp_objectives", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => ispGoalsTable.id),
  objectiveStatement: text("objective_statement").notNull(),
  criteria: text("criteria"),
  staffResponsibility: text("staff_responsibility"),
  frequency: text("frequency"),
  status: text("status").notNull().default("active"),
  progressPercent: integer("progress_percent").notNull().default(0),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  reviewedBy: integer("reviewed_by").references(() => staffTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ispProgressTable = pgTable("isp_progress", {
  id: serial("id").primaryKey(),
  objectiveId: integer("objective_id").notNull().references(() => ispObjectivesTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  recordedBy: integer("recorded_by").references(() => staffTable.id),
  progressRating: text("progress_rating").notNull(),
  dataValue: text("data_value"),
  observation: text("observation"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIspPlanSchema = createInsertSchema(ispPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIspPlan = z.infer<typeof insertIspPlanSchema>;
export type IspPlan = typeof ispPlansTable.$inferSelect;

export const insertIspGoalSchema = createInsertSchema(ispGoalsTable).omit({ id: true, createdAt: true });
export type InsertIspGoal = z.infer<typeof insertIspGoalSchema>;
export type IspGoal = typeof ispGoalsTable.$inferSelect;

export const insertIspObjectiveSchema = createInsertSchema(ispObjectivesTable).omit({ id: true, createdAt: true });
export type InsertIspObjective = z.infer<typeof insertIspObjectiveSchema>;
export type IspObjective = typeof ispObjectivesTable.$inferSelect;

export const insertIspProgressSchema = createInsertSchema(ispProgressTable).omit({ id: true, recordedAt: true });
export type InsertIspProgress = z.infer<typeof insertIspProgressSchema>;
export type IspProgress = typeof ispProgressTable.$inferSelect;
