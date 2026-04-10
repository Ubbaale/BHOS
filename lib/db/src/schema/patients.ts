import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { homesTable } from "./homes";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  mrn: text("mrn").unique(),
  externalEhrId: text("external_ehr_id"),
  ehrSystem: text("ehr_system"),
  ssn: text("ssn"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  middleName: text("middle_name"),
  dateOfBirth: timestamp("date_of_birth", { withTimezone: true }).notNull(),
  gender: text("gender").notNull(),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  admissionDate: timestamp("admission_date", { withTimezone: true }).notNull().defaultNow(),
  dischargeDate: timestamp("discharge_date", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  diagnosis: text("diagnosis"),
  primaryDiagnosisCode: text("primary_diagnosis_code"),
  secondaryDiagnoses: text("secondary_diagnoses"),
  allergies: text("allergies"),
  weight: numeric("weight"),
  photoUrl: text("photo_url"),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  insuranceGroupNumber: text("insurance_group_number"),
  medicaidId: text("medicaid_id"),
  primaryPhysician: text("primary_physician"),
  primaryPhysicianPhone: text("primary_physician_phone"),
  psychiatrist: text("psychiatrist"),
  psychiatristPhone: text("psychiatrist_phone"),
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  legalGuardian: text("legal_guardian"),
  legalGuardianPhone: text("legal_guardian_phone"),
  advanceDirective: text("advance_directive"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
