import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { medicationsTable } from "./medications";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";

export const medicationErrorsTable = pgTable("medication_errors", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").notNull().references(() => medicationsTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  errorType: text("error_type").notNull(),
  severity: text("severity").notNull().default("low"),
  description: text("description").notNull(),
  actionTaken: text("action_taken"),
  status: text("status").notNull().default("open"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: integer("resolved_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationErrorSchema = createInsertSchema(medicationErrorsTable).omit({ id: true, createdAt: true });
export type InsertMedicationError = z.infer<typeof insertMedicationErrorSchema>;
export type MedicationError = typeof medicationErrorsTable.$inferSelect;
