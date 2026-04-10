import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";
import { homesTable } from "./homes";

export const patientAppointmentsTable = pgTable("patient_appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  homeId: integer("home_id").references(() => homesTable.id),
  appointmentType: text("appointment_type").notNull(),
  provider: text("provider").notNull(),
  providerPhone: text("provider_phone"),
  location: text("location"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  status: text("status").notNull().default("scheduled"),
  notes: text("notes"),
  transportNeeded: boolean("transport_needed").notNull().default(false),
  assignedStaffId: integer("assigned_staff_id").references(() => staffTable.id),
  reminderSentToStaff: boolean("reminder_sent_to_staff").notNull().default(false),
  reminderSentToFamily: boolean("reminder_sent_to_family").notNull().default(false),
  outcome: text("outcome"),
  followUpDate: timestamp("follow_up_date", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPatientAppointmentSchema = createInsertSchema(patientAppointmentsTable).omit({ id: true, createdAt: true });
export type InsertPatientAppointment = z.infer<typeof insertPatientAppointmentSchema>;
export type PatientAppointment = typeof patientAppointmentsTable.$inferSelect;
