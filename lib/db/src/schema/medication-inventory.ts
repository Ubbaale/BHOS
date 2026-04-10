import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { medicationsTable } from "./medications";
import { staffTable } from "./staff";

export const medicationInventoryTable = pgTable("medication_inventory", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").notNull().references(() => medicationsTable.id),
  changeType: text("change_type").notNull(),
  quantity: integer("quantity").notNull(),
  previousQuantity: integer("previous_quantity"),
  newQuantity: integer("new_quantity"),
  performedBy: integer("performed_by").notNull().references(() => staffTable.id),
  witnessedBy: integer("witnessed_by").references(() => staffTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationInventorySchema = createInsertSchema(medicationInventoryTable).omit({ id: true, createdAt: true });
export type InsertMedicationInventory = z.infer<typeof insertMedicationInventorySchema>;
export type MedicationInventory = typeof medicationInventoryTable.$inferSelect;
