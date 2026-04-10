import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const medicationAuditLogTable = pgTable("medication_audit_log", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  performedBy: integer("performed_by").notNull(),
  performedByName: text("performed_by_name"),
  details: text("details"),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationAuditLogSchema = createInsertSchema(medicationAuditLogTable).omit({ id: true, createdAt: true });
export type InsertMedicationAuditLog = z.infer<typeof insertMedicationAuditLogSchema>;
export type MedicationAuditLog = typeof medicationAuditLogTable.$inferSelect;
