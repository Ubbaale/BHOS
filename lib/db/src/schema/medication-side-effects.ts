import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { medicationsTable } from "./medications";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";
import { medicationAdministrationsTable } from "./medication-administrations";

export const medicationSideEffectsTable = pgTable("medication_side_effects", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").notNull().references(() => medicationsTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  administrationId: integer("administration_id").references(() => medicationAdministrationsTable.id),
  sideEffect: text("side_effect").notNull(),
  severity: text("severity").notNull().default("mild"),
  onsetTime: timestamp("onset_time", { withTimezone: true }).notNull().defaultNow(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationSideEffectSchema = createInsertSchema(medicationSideEffectsTable).omit({ id: true, createdAt: true });
export type InsertMedicationSideEffect = z.infer<typeof insertMedicationSideEffectSchema>;
export type MedicationSideEffect = typeof medicationSideEffectsTable.$inferSelect;
