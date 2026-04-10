import { pgTable, text, serial, integer, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";
import { homesTable } from "./homes";

export const timePunchesTable = pgTable("time_punches", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  type: text("type").notNull(),
  punchTime: timestamp("punch_time", { withTimezone: true }).notNull().defaultNow(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  isWithinGeofence: boolean("is_within_geofence"),
  distanceFromHome: numeric("distance_from_home", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTimePunchSchema = createInsertSchema(timePunchesTable).omit({ id: true, createdAt: true });
export type InsertTimePunch = z.infer<typeof insertTimePunchSchema>;
export type TimePunch = typeof timePunchesTable.$inferSelect;
