import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { homesTable } from "./homes";

export const stateInspectorsTable = pgTable("state_inspectors", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  stateAgency: text("state_agency").notNull(),
  title: text("title"),
  phone: text("phone"),
  accessToken: text("access_token").notNull(),
  accessScope: jsonb("access_scope").$type<number[]>(),
  status: text("status").notNull().default("active"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inspectionVisitsTable = pgTable("inspection_visits", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  inspectorId: integer("inspector_id").notNull().references(() => stateInspectorsTable.id),
  visitType: text("visit_type").notNull().default("routine"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  visitDate: timestamp("visit_date", { withTimezone: true }),
  status: text("status").notNull().default("scheduled"),
  overallScore: integer("overall_score"),
  findings: text("findings"),
  deficiencies: text("deficiencies"),
  correctiveActions: text("corrective_actions"),
  correctiveDeadline: timestamp("corrective_deadline", { withTimezone: true }),
  followUpRequired: boolean("follow_up_required").notNull().default(false),
  followUpDate: timestamp("follow_up_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const complianceReportsTable = pgTable("compliance_reports", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  homeId: integer("home_id").references(() => homesTable.id),
  reportType: text("report_type").notNull(),
  reportPeriodStart: timestamp("report_period_start", { withTimezone: true }).notNull(),
  reportPeriodEnd: timestamp("report_period_end", { withTimezone: true }).notNull(),
  reportData: jsonb("report_data").$type<Record<string, unknown>>(),
  scores: jsonb("scores").$type<Record<string, number>>(),
  generatedBy: integer("generated_by"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stateAuditLogTable = pgTable("state_audit_log", {
  id: serial("id").primaryKey(),
  inspectorId: integer("inspector_id").notNull().references(() => stateInspectorsTable.id),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: integer("resource_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStateInspectorSchema = createInsertSchema(stateInspectorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStateInspector = z.infer<typeof insertStateInspectorSchema>;
export type StateInspector = typeof stateInspectorsTable.$inferSelect;

export const insertInspectionVisitSchema = createInsertSchema(inspectionVisitsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInspectionVisit = z.infer<typeof insertInspectionVisitSchema>;
export type InspectionVisit = typeof inspectionVisitsTable.$inferSelect;

export const insertComplianceReportSchema = createInsertSchema(complianceReportsTable).omit({ id: true, createdAt: true });
export type InsertComplianceReport = z.infer<typeof insertComplianceReportSchema>;
export type ComplianceReport = typeof complianceReportsTable.$inferSelect;

export type StateAuditLog = typeof stateAuditLogTable.$inferSelect;
