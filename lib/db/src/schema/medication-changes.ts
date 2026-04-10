import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { medicationsTable } from "./medications";
import { staffTable } from "./staff";
import { physicianOrdersTable } from "./physician-orders";

export const medicationChangesTable = pgTable("medication_changes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  oldMedicationId: integer("old_medication_id").references(() => medicationsTable.id),
  newMedicationId: integer("new_medication_id").references(() => medicationsTable.id),
  changeType: text("change_type").notNull(),
  reason: text("reason").notNull(),
  orderedBy: text("ordered_by").notNull(),
  physicianOrderId: integer("physician_order_id").references(() => physicianOrdersTable.id),
  oldDetails: text("old_details"),
  newDetails: text("new_details"),
  effectiveDate: timestamp("effective_date", { withTimezone: true }).notNull().defaultNow(),
  processedBy: integer("processed_by").references(() => staffTable.id),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refillRequestsTable = pgTable("refill_requests", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").notNull().references(() => medicationsTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  requestedBy: integer("requested_by").notNull().references(() => staffTable.id),
  pharmacyName: text("pharmacy_name"),
  pharmacyPhone: text("pharmacy_phone"),
  rxNumber: text("rx_number"),
  quantityRequested: integer("quantity_requested"),
  status: text("status").notNull().default("pending"),
  pharmacyContactedAt: timestamp("pharmacy_contacted_at", { withTimezone: true }),
  expectedFillDate: timestamp("expected_fill_date", { withTimezone: true }),
  receivedBy: integer("received_by").references(() => staffTable.id),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
