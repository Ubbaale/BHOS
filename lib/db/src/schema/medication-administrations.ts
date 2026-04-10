import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { medicationsTable } from "./medications";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";

export const medicationAdministrationsTable = pgTable("medication_administrations", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").notNull().references(() => medicationsTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  administeredAt: timestamp("administered_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("given"),
  notes: text("notes"),
  scheduledTime: timestamp("scheduled_time", { withTimezone: true }),
  windowStart: timestamp("window_start", { withTimezone: true }),
  windowEnd: timestamp("window_end", { withTimezone: true }),
  prnReason: text("prn_reason"),
  prnEffectiveness: text("prn_effectiveness"),
  prnFollowUpAt: timestamp("prn_follow_up_at", { withTimezone: true }),
  prnFollowUpNotes: text("prn_follow_up_notes"),
  barcodeScanVerified: boolean("barcode_scan_verified").notNull().default(false),
  witnessStaffId: integer("witness_staff_id").references(() => staffTable.id),
  relatedIncidentId: integer("related_incident_id"),
  prnFollowUpDueAt: timestamp("prn_follow_up_due_at", { withTimezone: true }),
  prnEffectivenessScore: integer("prn_effectiveness_score"),
  fiveRightsVerified: boolean("five_rights_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationAdministrationSchema = createInsertSchema(medicationAdministrationsTable).omit({ id: true, createdAt: true });
export type InsertMedicationAdministration = z.infer<typeof insertMedicationAdministrationSchema>;
export type MedicationAdministration = typeof medicationAdministrationsTable.$inferSelect;
