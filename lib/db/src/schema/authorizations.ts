import { pgTable, text, serial, integer, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";
import { payersTable } from "./payers";

export const authorizationsTable = pgTable("authorizations", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  payerId: integer("payer_id").references(() => payersTable.id),
  authorizationNumber: text("authorization_number").notNull(),
  serviceType: text("service_type").notNull(),
  approvedUnits: integer("approved_units").notNull(),
  usedUnits: integer("used_units").notNull().default(0),
  remainingUnits: integer("remaining_units"),
  unitType: text("unit_type").notNull().default("days"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("active"),
  requestedBy: integer("requested_by").references(() => staffTable.id),
  requestedDate: timestamp("requested_date", { withTimezone: true }),
  approvedDate: timestamp("approved_date", { withTimezone: true }),
  denialReason: text("denial_reason"),
  alertThresholdPercent: integer("alert_threshold_percent").notNull().default(80),
  alertSent: boolean("alert_sent").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authorizationHistoryTable = pgTable("authorization_history", {
  id: serial("id").primaryKey(),
  authorizationId: integer("authorization_id").notNull().references(() => authorizationsTable.id),
  action: text("action").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  unitsChanged: integer("units_changed"),
  performedBy: integer("performed_by").references(() => staffTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuthorizationSchema = createInsertSchema(authorizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAuthorization = z.infer<typeof insertAuthorizationSchema>;
export type Authorization = typeof authorizationsTable.$inferSelect;

export const insertAuthorizationHistorySchema = createInsertSchema(authorizationHistoryTable).omit({ id: true, createdAt: true });
export type InsertAuthorizationHistory = z.infer<typeof insertAuthorizationHistorySchema>;
export type AuthorizationHistory = typeof authorizationHistoryTable.$inferSelect;
