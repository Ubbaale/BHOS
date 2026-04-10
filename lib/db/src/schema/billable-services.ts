import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";

export const billableServicesTable = pgTable("billable_services", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  staffId: integer("staff_id").references(() => staffTable.id),
  serviceDate: timestamp("service_date", { withTimezone: true }).notNull().defaultNow(),
  serviceType: text("service_type").notNull(),
  cptCode: text("cpt_code"),
  hcpcsCode: text("hcpcs_code"),
  revenueCode: text("revenue_code"),
  modifiers: text("modifiers"),
  units: numeric("units").notNull().default("1"),
  unitRate: numeric("unit_rate").notNull().default("0"),
  totalCharge: numeric("total_charge").notNull().default("0"),
  diagnosisCode: text("diagnosis_code"),
  placeOfService: text("place_of_service").default("31"),
  description: text("description"),
  status: text("status").notNull().default("unbilled"),
  claimId: integer("claim_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBillableServiceSchema = createInsertSchema(billableServicesTable).omit({ id: true, createdAt: true });
export type InsertBillableService = z.infer<typeof insertBillableServiceSchema>;
export type BillableService = typeof billableServicesTable.$inferSelect;
