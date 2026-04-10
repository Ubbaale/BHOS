import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";
import { homesTable } from "./homes";
import { timePunchesTable } from "./time-punches";

export const fraudAlertsTable = pgTable("fraud_alerts", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  homeId: integer("home_id").references(() => homesTable.id),
  timePunchId: integer("time_punch_id").references(() => timePunchesTable.id),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull().default("medium"),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  reviewedBy: integer("reviewed_by").references(() => staffTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFraudAlertSchema = createInsertSchema(fraudAlertsTable).omit({ id: true, createdAt: true });
export type InsertFraudAlert = z.infer<typeof insertFraudAlertSchema>;
export type FraudAlert = typeof fraudAlertsTable.$inferSelect;
