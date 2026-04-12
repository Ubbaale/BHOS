import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { staffTable } from "./staff";

export const credentialTypesTable = pgTable("credential_types", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  category: text("category").notNull().default("license"),
  description: text("description"),
  isRequired: boolean("is_required").notNull().default(false),
  renewalPeriodMonths: integer("renewal_period_months"),
  reminderDaysBefore: integer("reminder_days_before").notNull().default(30),
  appliesToRoles: text("applies_to_roles"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffCredentialsTable = pgTable("staff_credentials", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  credentialTypeId: integer("credential_type_id").references(() => credentialTypesTable.id),
  credentialName: text("credential_name").notNull(),
  credentialNumber: text("credential_number"),
  issuingAuthority: text("issuing_authority"),
  issueDate: timestamp("issue_date", { withTimezone: true }),
  expirationDate: timestamp("expiration_date", { withTimezone: true }),
  documentUrl: text("document_url"),
  status: text("status").notNull().default("active"),
  verifiedBy: integer("verified_by").references(() => staffTable.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  alertSent: boolean("alert_sent").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const credentialAlertsTable = pgTable("credential_alerts", {
  id: serial("id").primaryKey(),
  credentialId: integer("credential_id").notNull().references(() => staffCredentialsTable.id),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  alertType: text("alert_type").notNull().default("expiring_soon"),
  message: text("message").notNull(),
  daysUntilExpiry: integer("days_until_expiry"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedBy: integer("acknowledged_by").references(() => staffTable.id),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCredentialTypeSchema = createInsertSchema(credentialTypesTable).omit({ id: true, createdAt: true });
export type InsertCredentialType = z.infer<typeof insertCredentialTypeSchema>;
export type CredentialType = typeof credentialTypesTable.$inferSelect;

export const insertStaffCredentialSchema = createInsertSchema(staffCredentialsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStaffCredential = z.infer<typeof insertStaffCredentialSchema>;
export type StaffCredential = typeof staffCredentialsTable.$inferSelect;

export const insertCredentialAlertSchema = createInsertSchema(credentialAlertsTable).omit({ id: true, createdAt: true });
export type InsertCredentialAlert = z.infer<typeof insertCredentialAlertSchema>;
export type CredentialAlert = typeof credentialAlertsTable.$inferSelect;
