import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const jobs = pgTable("jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  facility: text("facility").notNull(),
  location: text("location").notNull(),
  zipCode: text("zip_code"),
  state: text("state"),
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  pay: text("pay").notNull(),
  shift: text("shift").notNull(),
  urgency: text("urgency").notNull(),
  requirements: text("requirements").array().notNull(),
  status: text("status").notNull().default("available"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true }).extend({
  requirements: z.array(z.string()).min(1, "At least one requirement is required"),
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shiftId: text("shift_id").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull(),
  description: text("description").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("open"),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({ status: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

export const patientProfiles = pgTable("patient_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  mobilityNeeds: text("mobility_needs").array().default([]),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  savedAddresses: text("saved_addresses").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPatientProfileSchema = z.object({
  userId: z.string().optional(),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  mobilityNeeds: z.array(z.string()).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  savedAddresses: z.array(z.string()).optional(),
});
export type InsertPatientProfile = z.infer<typeof insertPatientProfileSchema>;
export type PatientProfile = typeof patientProfiles.$inferSelect;

export const driverProfiles = pgTable("driver_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  vehicleType: text("vehicle_type").notNull(),
  vehiclePlate: text("vehicle_plate").notNull(),
  wheelchairAccessible: boolean("wheelchair_accessible").default(false),
  stretcherCapable: boolean("stretcher_capable").default(false),
  isAvailable: boolean("is_available").default(true),
  currentLat: numeric("current_lat"),
  currentLng: numeric("current_lng"),
  applicationStatus: text("application_status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDriverProfileSchema = z.object({
  userId: z.string().optional(),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  vehicleType: z.string().min(1),
  vehiclePlate: z.string().min(1),
  wheelchairAccessible: z.boolean().optional(),
  stretcherCapable: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  currentLat: z.string().optional(),
  currentLng: z.string().optional(),
});
export type InsertDriverProfile = z.infer<typeof insertDriverProfileSchema>;
export type DriverProfile = typeof driverProfiles.$inferSelect;

export const rides = pgTable("rides", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  patientId: integer("patient_id").references(() => patientProfiles.id),
  driverId: integer("driver_id").references(() => driverProfiles.id),
  patientName: text("patient_name").notNull(),
  patientPhone: text("patient_phone").notNull(),
  pickupAddress: text("pickup_address").notNull(),
  pickupLat: numeric("pickup_lat").notNull(),
  pickupLng: numeric("pickup_lng").notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  dropoffLat: numeric("dropoff_lat").notNull(),
  dropoffLng: numeric("dropoff_lng").notNull(),
  appointmentTime: timestamp("appointment_time").notNull(),
  mobilityNeeds: text("mobility_needs").array().default([]),
  notes: text("notes"),
  status: text("status").notNull().default("requested"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRideSchema = z.object({
  patientId: z.number().optional(),
  driverId: z.number().optional(),
  patientName: z.string().min(1),
  patientPhone: z.string().min(1),
  pickupAddress: z.string().min(1),
  pickupLat: z.string(),
  pickupLng: z.string(),
  dropoffAddress: z.string().min(1),
  dropoffLat: z.string(),
  dropoffLng: z.string(),
  appointmentTime: z.coerce.date(),
  mobilityNeeds: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type InsertRide = z.infer<typeof insertRideSchema>;
export type Ride = typeof rides.$inferSelect;

export const rideEvents = pgTable("ride_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rideId: integer("ride_id").references(() => rides.id).notNull(),
  status: text("status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRideEventSchema = z.object({
  rideId: z.number(),
  status: z.string().min(1),
  note: z.string().optional(),
});
export type InsertRideEvent = z.infer<typeof insertRideEventSchema>;
export type RideEvent = typeof rideEvents.$inferSelect;

export const rideStatuses = ["requested", "accepted", "driver_enroute", "arrived", "in_progress", "completed", "cancelled"] as const;
export type RideStatus = typeof rideStatuses[number];

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userType: text("user_type").notNull().default("user"),
  driverId: integer("driver_id").references(() => driverProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPushSubscriptionSchema = z.object({
  endpoint: z.string().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userType: z.string().optional(),
  driverId: z.number().optional(),
});
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const nativePushTokens = pgTable("native_push_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  token: text("token").notNull().unique(),
  platform: text("platform").notNull(),
  userType: text("user_type").notNull().default("user"),
  driverId: integer("driver_id").references(() => driverProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNativePushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
  userType: z.string().optional(),
  driverId: z.number().optional(),
});
export type InsertNativePushToken = z.infer<typeof insertNativePushTokenSchema>;
export type NativePushToken = typeof nativePushTokens.$inferSelect;
