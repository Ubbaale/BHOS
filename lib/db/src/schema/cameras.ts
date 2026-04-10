import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { homesTable } from "./homes";

export const camerasTable = pgTable("cameras", {
  id: serial("id").primaryKey(),
  homeId: integer("home_id")
    .notNull()
    .references(() => homesTable.id),
  name: text("name").notNull(),
  location: text("location").notNull(),
  cameraType: text("camera_type").notNull().default("indoor"),
  brand: text("brand"),
  model: text("model"),
  streamUrl: text("stream_url"),
  dashboardUrl: text("dashboard_url"),
  resolution: text("resolution"),
  hasNightVision: boolean("has_night_vision").notNull().default(false),
  hasAudio: boolean("has_audio").notNull().default(false),
  hasMotionDetection: boolean("has_motion_detection").notNull().default(false),
  recordingMode: text("recording_mode").notNull().default("continuous"),
  retentionDays: integer("retention_days").notNull().default(30),
  status: text("status").notNull().default("online"),
  lastOnlineAt: timestamp("last_online_at", { withTimezone: true }),
  installedAt: timestamp("installed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cameraEventsTable = pgTable("camera_events", {
  id: serial("id").primaryKey(),
  cameraId: integer("camera_id")
    .notNull()
    .references(() => camerasTable.id),
  eventType: text("event_type").notNull(),
  description: text("description"),
  clipUrl: text("clip_url"),
  thumbnailUrl: text("thumbnail_url"),
  incidentId: integer("incident_id"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
