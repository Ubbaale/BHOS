import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { medicationsTable } from "./medications";

export const physicianOrdersTable = pgTable("physician_orders", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  medicationId: integer("medication_id").references(() => medicationsTable.id),
  orderType: text("order_type").notNull(),
  orderedBy: text("ordered_by").notNull(),
  details: text("details"),
  effectiveDate: timestamp("effective_date", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
  processedBy: integer("processed_by"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPhysicianOrderSchema = createInsertSchema(physicianOrdersTable).omit({ id: true, createdAt: true });
export type InsertPhysicianOrder = z.infer<typeof insertPhysicianOrderSchema>;
export type PhysicianOrder = typeof physicianOrdersTable.$inferSelect;
