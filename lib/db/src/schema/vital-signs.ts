import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";
import { medicationAdministrationsTable } from "./medication-administrations";

export const vitalSignsTable = pgTable("vital_signs", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  administrationId: integer("administration_id").references(() => medicationAdministrationsTable.id),
  systolicBp: integer("systolic_bp"),
  diastolicBp: integer("diastolic_bp"),
  heartRate: integer("heart_rate"),
  temperature: numeric("temperature", { precision: 4, scale: 1 }),
  respiratoryRate: integer("respiratory_rate"),
  oxygenSaturation: integer("oxygen_saturation"),
  painLevel: integer("pain_level"),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVitalSignsSchema = createInsertSchema(vitalSignsTable).omit({ id: true, createdAt: true });
export type InsertVitalSigns = z.infer<typeof insertVitalSignsSchema>;
export type VitalSigns = typeof vitalSignsTable.$inferSelect;
