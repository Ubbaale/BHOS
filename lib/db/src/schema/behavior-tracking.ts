import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";
import { homesTable } from "./homes";

export const behaviorDefinitionsTable = pgTable("behavior_definitions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  behaviorName: text("behavior_name").notNull(),
  operationalDefinition: text("operational_definition").notNull(),
  category: text("category").notNull().default("target"),
  severity: text("severity").notNull().default("moderate"),
  measurementType: text("measurement_type").notNull().default("frequency"),
  status: text("status").notNull().default("active"),
  createdBy: integer("created_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const behaviorIncidentsTable = pgTable("behavior_incidents", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  behaviorId: integer("behavior_id").notNull().references(() => behaviorDefinitionsTable.id),
  homeId: integer("home_id").references(() => homesTable.id),
  antecedent: text("antecedent"),
  behavior: text("behavior").notNull(),
  consequence: text("consequence"),
  intensity: text("intensity").notNull().default("moderate"),
  durationMinutes: integer("duration_minutes"),
  location: text("location"),
  interventionUsed: text("intervention_used"),
  interventionEffective: text("intervention_effective"),
  staffPresent: text("staff_present"),
  notes: text("notes"),
  recordedBy: integer("recorded_by").references(() => staffTable.id),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const behaviorInterventionPlansTable = pgTable("behavior_intervention_plans", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  title: text("title").notNull(),
  targetBehaviors: text("target_behaviors"),
  preventionStrategies: text("prevention_strategies"),
  replacementBehaviors: text("replacement_behaviors"),
  consequenceStrategies: text("consequence_strategies"),
  crisisPlan: text("crisis_plan"),
  effectiveDate: timestamp("effective_date", { withTimezone: true }),
  reviewDate: timestamp("review_date", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  createdBy: integer("created_by").references(() => staffTable.id),
  approvedBy: integer("approved_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBehaviorDefinitionSchema = createInsertSchema(behaviorDefinitionsTable).omit({ id: true, createdAt: true });
export type InsertBehaviorDefinition = z.infer<typeof insertBehaviorDefinitionSchema>;
export type BehaviorDefinition = typeof behaviorDefinitionsTable.$inferSelect;

export const insertBehaviorIncidentSchema = createInsertSchema(behaviorIncidentsTable).omit({ id: true, createdAt: true });
export type InsertBehaviorIncident = z.infer<typeof insertBehaviorIncidentSchema>;
export type BehaviorIncident = typeof behaviorIncidentsTable.$inferSelect;

export const insertBehaviorInterventionPlanSchema = createInsertSchema(behaviorInterventionPlansTable).omit({ id: true, createdAt: true });
export type InsertBehaviorInterventionPlan = z.infer<typeof insertBehaviorInterventionPlanSchema>;
export type BehaviorInterventionPlan = typeof behaviorInterventionPlansTable.$inferSelect;
