import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { medicationsTable } from "./medications";
import { staffTable } from "./staff";
import { shiftsTable } from "./shifts";

export const medicationCountsTable = pgTable("medication_counts", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").notNull().references(() => medicationsTable.id),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  witnessStaffId: integer("witness_staff_id").references(() => staffTable.id),
  shiftId: integer("shift_id").references(() => shiftsTable.id),
  countBefore: integer("count_before").notNull(),
  countAfter: integer("count_after").notNull(),
  discrepancy: integer("discrepancy").notNull().default(0),
  countedAt: timestamp("counted_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationCountSchema = createInsertSchema(medicationCountsTable).omit({ id: true, createdAt: true });
export type InsertMedicationCount = z.infer<typeof insertMedicationCountSchema>;
export type MedicationCount = typeof medicationCountsTable.$inferSelect;
