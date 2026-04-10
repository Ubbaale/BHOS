import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";
import { homesTable } from "./homes";

export const dailyLogsTable = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  mood: text("mood").notNull(),
  appetite: text("appetite").notNull(),
  sleep: text("sleep").notNull(),
  activities: text("activities"),
  behaviors: text("behaviors"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyLogSchema = createInsertSchema(dailyLogsTable).omit({ id: true, createdAt: true });
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogsTable.$inferSelect;
