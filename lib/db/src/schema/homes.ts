import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const homesTable = pgTable("homes", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id"),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  region: text("region").notNull(),
  capacity: integer("capacity").notNull(),
  currentOccupancy: integer("current_occupancy").notNull().default(0),
  status: text("status").notNull().default("active"),
  phone: text("phone"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  geofenceRadiusMeters: integer("geofence_radius_meters").notNull().default(150),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHomeSchema = createInsertSchema(homesTable).omit({ id: true, createdAt: true, currentOccupancy: true });
export type InsertHome = z.infer<typeof insertHomeSchema>;
export type Home = typeof homesTable.$inferSelect;
