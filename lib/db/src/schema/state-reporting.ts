import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { staffTable } from "./staff";
import { homesTable } from "./homes";

export const stateReportsTable = pgTable("state_reports", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  homeId: integer("home_id").references(() => homesTable.id),
  reportType: text("report_type").notNull(),
  reportPeriod: text("report_period"),
  state: text("state").notNull(),
  status: text("status").notNull().default("draft"),
  reportData: text("report_data"),
  submittedTo: text("submitted_to"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  submittedBy: integer("submitted_by").references(() => staffTable.id),
  confirmationNumber: text("confirmation_number"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reportSchedulesTable = pgTable("report_schedules", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  reportType: text("report_type").notNull(),
  state: text("state").notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  nextDueDate: timestamp("next_due_date", { withTimezone: true }),
  recipientAgency: text("recipient_agency"),
  submissionMethod: text("submission_method").notNull().default("electronic"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStateReportSchema = createInsertSchema(stateReportsTable).omit({ id: true, createdAt: true });
export type InsertStateReport = z.infer<typeof insertStateReportSchema>;
export type StateReport = typeof stateReportsTable.$inferSelect;

export const insertReportScheduleSchema = createInsertSchema(reportSchedulesTable).omit({ id: true, createdAt: true });
export type InsertReportSchedule = z.infer<typeof insertReportScheduleSchema>;
export type ReportSchedule = typeof reportSchedulesTable.$inferSelect;
