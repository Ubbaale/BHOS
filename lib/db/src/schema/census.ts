import { pgTable, text, serial, integer, timestamp, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { homesTable } from "./homes";
import { patientsTable } from "./patients";

export const censusRecordsTable = pgTable("census_records", {
  id: serial("id").primaryKey(),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  recordDate: date("record_date").notNull(),
  totalBeds: integer("total_beds").notNull(),
  occupiedBeds: integer("occupied_beds").notNull().default(0),
  availableBeds: integer("available_beds").notNull().default(0),
  admissionsToday: integer("admissions_today").notNull().default(0),
  dischargesToday: integer("discharges_today").notNull().default(0),
  transfersIn: integer("transfers_in").notNull().default(0),
  transfersOut: integer("transfers_out").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bedAssignmentsTable = pgTable("bed_assignments", {
  id: serial("id").primaryKey(),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  bedNumber: text("bed_number").notNull(),
  roomNumber: text("room_number"),
  floor: text("floor"),
  wing: text("wing"),
  status: text("status").notNull().default("occupied"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  vacatedAt: timestamp("vacated_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCensusRecordSchema = createInsertSchema(censusRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCensusRecord = z.infer<typeof insertCensusRecordSchema>;
export type CensusRecord = typeof censusRecordsTable.$inferSelect;

export const insertBedAssignmentSchema = createInsertSchema(bedAssignmentsTable).omit({ id: true, createdAt: true });
export type InsertBedAssignment = z.infer<typeof insertBedAssignmentSchema>;
export type BedAssignment = typeof bedAssignmentsTable.$inferSelect;
