import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { medicationsTable } from "./medications";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";

export const medicationRefusalsTable = pgTable("medication_refusals", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").notNull().references(() => medicationsTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  scheduledTime: timestamp("scheduled_time", { withTimezone: true }),
  reason: text("reason").notNull(),
  physicianNotified: boolean("physician_notified").notNull().default(false),
  physicianNotifiedAt: timestamp("physician_notified_at", { withTimezone: true }),
  physicianName: text("physician_name"),
  followUpAction: text("follow_up_action"),
  followUpNotes: text("follow_up_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationRefusalSchema = createInsertSchema(medicationRefusalsTable).omit({ id: true, createdAt: true });
export type InsertMedicationRefusal = z.infer<typeof insertMedicationRefusalSchema>;
export type MedicationRefusal = typeof medicationRefusalsTable.$inferSelect;
