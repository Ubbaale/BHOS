import { pgTable, text, serial, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const medicationsTable = pgTable("medications", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  frequency: text("frequency").notNull(),
  route: text("route").notNull().default("oral"),
  prescribedBy: text("prescribed_by"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  instructions: text("instructions"),
  controlledSubstance: boolean("controlled_substance").notNull().default(false),
  deaSchedule: text("dea_schedule"),
  ndcCode: text("ndc_code"),
  medicationType: text("medication_type").notNull().default("scheduled"),
  quantityOnHand: integer("quantity_on_hand"),
  quantityPerRefill: integer("quantity_per_refill"),
  refillThreshold: integer("refill_threshold"),
  pharmacyName: text("pharmacy_name"),
  pharmacyPhone: text("pharmacy_phone"),
  rxNumber: text("rx_number"),
  scheduleTimesJson: text("schedule_times_json"),
  imageUrl: text("image_url"),
  lotNumber: text("lot_number"),
  expirationDate: timestamp("expiration_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationSchema = createInsertSchema(medicationsTable).omit({ id: true, createdAt: true, active: true });
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medicationsTable.$inferSelect;
