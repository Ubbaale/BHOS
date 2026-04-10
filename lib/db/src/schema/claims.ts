import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { payersTable } from "./payers";

export const claimsTable = pgTable("claims", {
  id: serial("id").primaryKey(),
  claimNumber: text("claim_number").unique(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  payerId: integer("payer_id").notNull().references(() => payersTable.id),
  serviceStartDate: timestamp("service_start_date", { withTimezone: true }).notNull(),
  serviceEndDate: timestamp("service_end_date", { withTimezone: true }).notNull(),
  totalCharged: numeric("total_charged").notNull().default("0"),
  totalAllowed: numeric("total_allowed"),
  totalPaid: numeric("total_paid").notNull().default("0"),
  patientResponsibility: numeric("patient_responsibility").default("0"),
  status: text("status").notNull().default("draft"),
  claimType: text("claim_type").notNull().default("professional"),
  primaryDiagnosisCode: text("primary_diagnosis_code"),
  secondaryDiagnosisCodes: text("secondary_diagnosis_codes"),
  renderingProvider: text("rendering_provider"),
  referringProvider: text("referring_provider"),
  authorizationNumber: text("authorization_number"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  denialReason: text("denial_reason"),
  denialCode: text("denial_code"),
  appealDeadline: timestamp("appeal_deadline", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClaimSchema = createInsertSchema(claimsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claimsTable.$inferSelect;
