import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { homesTable } from "./homes";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  reportedBy: integer("reported_by").notNull().references(() => staffTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("low"),
  category: text("category").notNull().default("other"),
  status: text("status").notNull().default("open"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ id: true, createdAt: true, resolvedAt: true, resolution: true });
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
