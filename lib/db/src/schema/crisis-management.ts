import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";
import { homesTable } from "./homes";

export const crisisPlansTable = pgTable("crisis_plans", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  triggerWarnings: text("trigger_warnings"),
  deescalationSteps: text("deescalation_steps"),
  preferredHospital: text("preferred_hospital"),
  emergencyContacts: text("emergency_contacts"),
  restrictionNotes: text("restriction_notes"),
  medicationProtocol: text("medication_protocol"),
  safetyPrecautions: text("safety_precautions"),
  status: text("status").notNull().default("active"),
  createdBy: integer("created_by").notNull().references(() => staffTable.id),
  approvedBy: integer("approved_by").references(() => staffTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  nextReviewDate: timestamp("next_review_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crisisEventsTable = pgTable("crisis_events", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  crisisPlanId: integer("crisis_plan_id").references(() => crisisPlansTable.id),
  reportedBy: integer("reported_by").notNull().references(() => staffTable.id),
  crisisType: text("crisis_type").notNull(),
  severity: text("severity").notNull().default("moderate"),
  description: text("description").notNull(),
  interventionsUsed: text("interventions_used"),
  restraintUsed: boolean("restraint_used").notNull().default(false),
  restraintType: text("restraint_type"),
  restraintStartTime: timestamp("restraint_start_time", { withTimezone: true }),
  restraintEndTime: timestamp("restraint_end_time", { withTimezone: true }),
  restraintJustification: text("restraint_justification"),
  seclusionUsed: boolean("seclusion_used").notNull().default(false),
  seclusionStartTime: timestamp("seclusion_start_time", { withTimezone: true }),
  seclusionEndTime: timestamp("seclusion_end_time", { withTimezone: true }),
  emergencyServicesCalledAt: timestamp("emergency_services_called_at", { withTimezone: true }),
  hospitalTransport: boolean("hospital_transport").notNull().default(false),
  hospitalName: text("hospital_name"),
  outcome: text("outcome"),
  status: text("status").notNull().default("active"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crisisDebriefingsTable = pgTable("crisis_debriefings", {
  id: serial("id").primaryKey(),
  crisisEventId: integer("crisis_event_id").notNull().references(() => crisisEventsTable.id),
  conductedBy: integer("conducted_by").notNull().references(() => staffTable.id),
  attendees: text("attendees"),
  whatHappened: text("what_happened"),
  whatWorked: text("what_worked"),
  whatToImprove: text("what_to_improve"),
  planUpdates: text("plan_updates"),
  followUpActions: text("follow_up_actions"),
  conductedAt: timestamp("conducted_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCrisisPlanSchema = createInsertSchema(crisisPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrisisPlan = z.infer<typeof insertCrisisPlanSchema>;
export type CrisisPlan = typeof crisisPlansTable.$inferSelect;

export const insertCrisisEventSchema = createInsertSchema(crisisEventsTable).omit({ id: true, createdAt: true });
export type InsertCrisisEvent = z.infer<typeof insertCrisisEventSchema>;
export type CrisisEvent = typeof crisisEventsTable.$inferSelect;

export const insertCrisisDebriefingSchema = createInsertSchema(crisisDebriefingsTable).omit({ id: true, createdAt: true });
export type InsertCrisisDebriefing = z.infer<typeof insertCrisisDebriefingSchema>;
export type CrisisDebriefing = typeof crisisDebriefingsTable.$inferSelect;
