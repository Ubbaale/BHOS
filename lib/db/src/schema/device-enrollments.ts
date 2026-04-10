import { pgTable, text, serial, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";

export const deviceEnrollmentsTable = pgTable("device_enrollments", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name").notNull(),
  platform: text("platform").notNull(),
  osVersion: text("os_version"),
  appVersion: text("app_version"),
  status: text("status").notNull().default("pending"),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: integer("approved_by").references(() => staffTable.id),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  notes: text("notes"),
}, (table) => [
  uniqueIndex("device_enrollments_staff_device_idx").on(table.staffId, table.deviceId),
]);

export const insertDeviceEnrollmentSchema = createInsertSchema(deviceEnrollmentsTable).omit({ id: true, enrolledAt: true });
export type InsertDeviceEnrollment = z.infer<typeof insertDeviceEnrollmentSchema>;
export type DeviceEnrollment = typeof deviceEnrollmentsTable.$inferSelect;
