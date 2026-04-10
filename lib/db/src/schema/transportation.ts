import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { homesTable } from "./homes";
import { staffTable } from "./staff";
import { patientsTable } from "./patients";

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("sedan"),
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  licensePlate: text("license_plate").notNull(),
  vin: text("vin"),
  capacity: integer("capacity").notNull().default(4),
  adaAccessible: boolean("ada_accessible").notNull().default(false),
  homeId: integer("home_id").references(() => homesTable.id),
  status: text("status").notNull().default("available"),
  insuranceExpiry: timestamp("insurance_expiry", { withTimezone: true }),
  inspectionExpiry: timestamp("inspection_expiry", { withTimezone: true }),
  mileage: integer("mileage"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const driversTable = pgTable("drivers", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  licenseNumber: text("license_number").notNull(),
  licenseState: text("license_state"),
  licenseExpiry: timestamp("license_expiry", { withTimezone: true }).notNull(),
  licenseType: text("license_type").notNull().default("standard"),
  vehicleId: integer("vehicle_id").references(() => vehiclesTable.id),
  status: text("status").notNull().default("active"),
  certifications: text("certifications"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transportRequestsTable = pgTable("transport_requests", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  appointmentId: integer("appointment_id"),
  homeId: integer("home_id").references(() => homesTable.id),
  transportType: text("transport_type").notNull().default("company"),
  pickupTime: timestamp("pickup_time", { withTimezone: true }).notNull(),
  returnTime: timestamp("return_time", { withTimezone: true }),
  pickupLocation: text("pickup_location").notNull(),
  dropoffLocation: text("dropoff_location").notNull(),
  driverId: integer("driver_id").references(() => driversTable.id),
  vehicleId: integer("vehicle_id").references(() => vehiclesTable.id),
  status: text("status").notNull().default("requested"),
  priority: text("priority").notNull().default("normal"),
  passengerCount: integer("passenger_count").notNull().default(1),
  wheelchairRequired: boolean("wheelchair_required").notNull().default(false),
  specialNeeds: text("special_needs"),
  externalProvider: text("external_provider"),
  externalConfirmation: text("external_confirmation"),
  estimatedCost: text("estimated_cost"),
  actualCost: text("actual_cost"),
  notes: text("notes"),
  requestedBy: text("requested_by"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true, createdAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;

export const insertDriverSchema = createInsertSchema(driversTable).omit({ id: true, createdAt: true });
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof driversTable.$inferSelect;

export const insertTransportRequestSchema = createInsertSchema(transportRequestsTable).omit({ id: true, createdAt: true });
export type InsertTransportRequest = z.infer<typeof insertTransportRequestSchema>;
export type TransportRequest = typeof transportRequestsTable.$inferSelect;
