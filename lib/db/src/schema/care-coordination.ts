import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";

export const externalProvidersTable = pgTable("external_providers", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  providerName: text("provider_name").notNull(),
  providerType: text("provider_type").notNull().default("psychiatrist"),
  specialty: text("specialty"),
  organization: text("organization"),
  phone: text("phone"),
  fax: text("fax"),
  email: text("email"),
  address: text("address"),
  npiNumber: text("npi_number"),
  licenseNumber: text("license_number"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const careReferralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  referralType: text("referral_type").notNull().default("incoming"),
  referredFrom: text("referred_from"),
  referredTo: text("referred_to"),
  externalProviderId: integer("external_provider_id").references(() => externalProvidersTable.id),
  reason: text("reason").notNull(),
  urgency: text("urgency").notNull().default("routine"),
  status: text("status").notNull().default("pending"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  completedDate: timestamp("completed_date", { withTimezone: true }),
  outcome: text("outcome"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communicationLogsTable = pgTable("communication_logs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  externalProviderId: integer("external_provider_id").references(() => externalProvidersTable.id),
  communicationType: text("communication_type").notNull().default("phone"),
  direction: text("direction").notNull().default("outgoing"),
  subject: text("subject"),
  summary: text("summary").notNull(),
  contactedBy: integer("contacted_by").references(() => staffTable.id),
  contactedAt: timestamp("contacted_at", { withTimezone: true }).notNull().defaultNow(),
  followUpNeeded: text("follow_up_needed"),
  followUpDate: timestamp("follow_up_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExternalProviderSchema = createInsertSchema(externalProvidersTable).omit({ id: true, createdAt: true });
export type InsertExternalProvider = z.infer<typeof insertExternalProviderSchema>;
export type ExternalProvider = typeof externalProvidersTable.$inferSelect;

export const insertCareReferralSchema = createInsertSchema(careReferralsTable).omit({ id: true, createdAt: true });
export type InsertCareReferral = z.infer<typeof insertCareReferralSchema>;
export type CareReferral = typeof careReferralsTable.$inferSelect;

export const insertCommunicationLogSchema = createInsertSchema(communicationLogsTable).omit({ id: true, createdAt: true });
export type InsertCommunicationLog = z.infer<typeof insertCommunicationLogSchema>;
export type CommunicationLog = typeof communicationLogsTable.$inferSelect;
