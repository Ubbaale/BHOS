import { pgTable, text, serial, integer, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const behaviorTrendsTable = pgTable("behavior_trends", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  recordDate: timestamp("record_date", { withTimezone: true }).notNull(),
  moodScore: integer("mood_score"),
  agitationLevel: integer("agitation_level"),
  sleepQuality: integer("sleep_quality"),
  appetiteLevel: integer("appetite_level"),
  socialEngagement: integer("social_engagement"),
  anxietyLevel: integer("anxiety_level"),
  cooperationLevel: integer("cooperation_level"),
  selfCareScore: integer("self_care_score"),
  triggers: text("triggers"),
  interventionsUsed: text("interventions_used"),
  notes: text("notes"),
  recordedBy: text("recorded_by"),
  shiftType: text("shift_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBehaviorTrendSchema = createInsertSchema(behaviorTrendsTable).omit({ id: true, createdAt: true });
export type InsertBehaviorTrend = z.infer<typeof insertBehaviorTrendSchema>;
export type BehaviorTrend = typeof behaviorTrendsTable.$inferSelect;

export const predictiveRiskScoresTable = pgTable("predictive_risk_scores", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  riskType: text("risk_type").notNull(),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  severity: text("severity").notNull(),
  factors: text("factors").notNull(),
  recommendation: text("recommendation").notNull(),
  dataPoints: integer("data_points").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPredictiveRiskScoreSchema = createInsertSchema(predictiveRiskScoresTable).omit({ id: true, createdAt: true, calculatedAt: true });
export type InsertPredictiveRiskScore = z.infer<typeof insertPredictiveRiskScoreSchema>;
export type PredictiveRiskScore = typeof predictiveRiskScoresTable.$inferSelect;
