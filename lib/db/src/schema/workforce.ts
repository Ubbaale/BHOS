import { pgTable, text, serial, integer, timestamp, numeric, boolean, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";
import { homesTable } from "./homes";
import { shiftsTable } from "./shifts";

export const shiftPostsTable = pgTable("shift_posts", {
  id: serial("id").primaryKey(),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  roleRequired: text("role_required").notNull().default("caregiver"),
  description: text("description"),
  urgency: text("urgency").notNull().default("normal"),
  postedBy: integer("posted_by").notNull().references(() => staffTable.id),
  status: text("status").notNull().default("open"),
  claimedBy: integer("claimed_by").references(() => staffTable.id),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  approvedBy: integer("approved_by").references(() => staffTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShiftPostSchema = createInsertSchema(shiftPostsTable).omit({ id: true, createdAt: true, claimedAt: true, approvedAt: true });
export type InsertShiftPost = z.infer<typeof insertShiftPostSchema>;
export type ShiftPost = typeof shiftPostsTable.$inferSelect;

export const shiftSwapRequestsTable = pgTable("shift_swap_requests", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull().references(() => staffTable.id),
  requesterShiftId: integer("requester_shift_id").notNull().references(() => shiftsTable.id),
  responderId: integer("responder_id").references(() => staffTable.id),
  responderShiftId: integer("responder_shift_id").references(() => shiftsTable.id),
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  approvedBy: integer("approved_by").references(() => staffTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShiftSwapSchema = createInsertSchema(shiftSwapRequestsTable).omit({ id: true, createdAt: true, approvedAt: true });
export type InsertShiftSwap = z.infer<typeof insertShiftSwapSchema>;
export type ShiftSwapRequest = typeof shiftSwapRequestsTable.$inferSelect;

export const staffAvailabilityTable = pgTable("staff_availability", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStaffAvailabilitySchema = createInsertSchema(staffAvailabilityTable).omit({ id: true, createdAt: true });
export type InsertStaffAvailability = z.infer<typeof insertStaffAvailabilitySchema>;
export type StaffAvailability = typeof staffAvailabilityTable.$inferSelect;

export const onboardingChecklistTable = pgTable("onboarding_checklist", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  isRequired: boolean("is_required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOnboardingChecklistSchema = createInsertSchema(onboardingChecklistTable).omit({ id: true, createdAt: true });
export type InsertOnboardingChecklist = z.infer<typeof insertOnboardingChecklistSchema>;
export type OnboardingChecklist = typeof onboardingChecklistTable.$inferSelect;

export const onboardingProgressTable = pgTable("onboarding_progress", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  checklistItemId: integer("checklist_item_id").notNull().references(() => onboardingChecklistTable.id),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
  notes: text("notes"),
  documentUrl: text("document_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOnboardingProgressSchema = createInsertSchema(onboardingProgressTable).omit({ id: true, createdAt: true });
export type InsertOnboardingProgress = z.infer<typeof insertOnboardingProgressSchema>;
export type OnboardingProgress = typeof onboardingProgressTable.$inferSelect;

export const overtimeAlertsTable = pgTable("overtime_alerts", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  weekStartDate: timestamp("week_start_date", { withTimezone: true }).notNull(),
  totalHours: numeric("total_hours", { precision: 6, scale: 2 }).notNull(),
  thresholdHours: numeric("threshold_hours", { precision: 6, scale: 2 }).notNull().default("40.00"),
  status: text("status").notNull().default("active"),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOvertimeAlertSchema = createInsertSchema(overtimeAlertsTable).omit({ id: true, createdAt: true });
export type InsertOvertimeAlert = z.infer<typeof insertOvertimeAlertSchema>;
export type OvertimeAlert = typeof overtimeAlertsTable.$inferSelect;

export const attendanceRecordsTable = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  shiftId: integer("shift_id").references(() => shiftsTable.id),
  type: text("type").notNull(),
  minutesLate: integer("minutes_late").default(0),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  actualStart: timestamp("actual_start", { withTimezone: true }),
  reportedBy: text("reported_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecordsTable).omit({ id: true, createdAt: true });
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;
