import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const medPassPinsTable = pgTable("med_pass_pins", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id).unique(),
  hashedPin: text("hashed_pin").notNull(),
  salt: text("salt").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pinAttemptLogsTable = pgTable("pin_attempt_logs", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  success: boolean("success").notNull(),
  context: text("context").notNull().default("med_administration"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
