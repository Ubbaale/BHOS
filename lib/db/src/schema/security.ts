import { pgTable, text, serial, integer, timestamp, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const phiAccessLogsTable = pgTable("phi_access_logs", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  userName: text("user_name"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  userAgent: text("user_agent"),
  geofenceStatus: text("geofence_status").notNull().default("unknown"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPhiAccessLogSchema = createInsertSchema(phiAccessLogsTable).omit({ id: true, createdAt: true });
export type InsertPhiAccessLog = z.infer<typeof insertPhiAccessLogSchema>;
export type PhiAccessLog = typeof phiAccessLogsTable.$inferSelect;

export const activeSessionsTable = pgTable("active_sessions", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  clerkSessionId: text("clerk_session_id"),
  userName: text("user_name"),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  lastActivity: timestamp("last_activity", { withTimezone: true }).notNull().defaultNow(),
  isRevoked: boolean("is_revoked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActiveSessionSchema = createInsertSchema(activeSessionsTable).omit({ id: true, createdAt: true, lastActivity: true });
export type InsertActiveSession = z.infer<typeof insertActiveSessionSchema>;
export type ActiveSession = typeof activeSessionsTable.$inferSelect;

export const securitySettingsTable = pgTable("security_settings", {
  id: serial("id").primaryKey(),
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(15),
  geofenceEnabled: boolean("geofence_enabled").notNull().default(false),
  geofenceRadiusMeters: integer("geofence_radius_meters").notNull().default(150),
  biometricRequired: boolean("biometric_required").notNull().default(false),
  biometricForControlledSubstances: boolean("biometric_for_controlled_substances").notNull().default(true),
  requireDevicePasscode: boolean("require_device_passcode").notNull().default(true),
  ipWhitelistEnabled: boolean("ip_whitelist_enabled").notNull().default(false),
  allowedIps: jsonb("allowed_ips").$type<string[]>().default([]),
  maxFailedAttempts: integer("max_failed_attempts").notNull().default(5),
  lockoutDurationMinutes: integer("lockout_duration_minutes").notNull().default(30),
  auditRetentionDays: integer("audit_retention_days").notNull().default(365),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const updateSecuritySettingsSchema = createInsertSchema(securitySettingsTable).omit({ id: true, updatedAt: true }).partial();
export type SecuritySettings = typeof securitySettingsTable.$inferSelect;
