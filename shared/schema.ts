import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
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
  // KYC fields
  driversLicenseNumber: text("drivers_license_number"),
  driversLicenseExpiry: text("drivers_license_expiry"),
  driversLicenseState: text("drivers_license_state"),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  insuranceExpiry: text("insurance_expiry"),
  vehicleYear: text("vehicle_year"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleColor: text("vehicle_color"),
  // Document uploads (file paths)
  driversLicenseDoc: text("drivers_license_doc"),
  vehicleRegistrationDoc: text("vehicle_registration_doc"),
  insuranceDoc: text("insurance_doc"),
  profilePhotoDoc: text("profile_photo_doc"),
  // KYC verification status
  kycStatus: text("kyc_status").notNull().default("not_submitted"),
  kycNotes: text("kyc_notes"),
  kycVerifiedAt: timestamp("kyc_verified_at"),
  // Driver reliability metrics
  totalRidesCompleted: integer("total_rides_completed").default(0),
  totalRidesCancelled: integer("total_rides_cancelled").default(0),
  averageRating: numeric("average_rating").default("5.0"),
  totalRatings: integer("total_ratings").default(0),
  // Account status
  accountStatus: text("account_status").default("active"), // 'active', 'suspended', 'deactivated'
  suspensionReason: text("suspension_reason"),
  // Navigation preference
  navigationPreference: text("navigation_preference").default("default"), // 'default', 'google_maps', 'waze', 'apple_maps'
  // Contractor onboarding fields
  isContractorOnboarded: boolean("is_contractor_onboarded").default(false),
  contractorAgreementSignedAt: timestamp("contractor_agreement_signed_at"),
  ssnLast4: text("ssn_last_4"), // Last 4 digits of SSN for 1099
  taxClassification: text("tax_classification").default("individual"), // 'individual', 'sole_proprietor', 'llc', 'corporation'
  businessName: text("business_name"), // If operating under a business name
  taxAddress: text("tax_address"),
  taxCity: text("tax_city"),
  taxState: text("tax_state"),
  taxZip: text("tax_zip"),
  w9ReceivedAt: timestamp("w9_received_at"),
  // Stripe Connect for payouts
  stripeConnectAccountId: text("stripe_connect_account_id"),
  stripeConnectOnboarded: boolean("stripe_connect_onboarded").default(false),
  payoutPreference: text("payout_preference").default("manual"), // 'manual', 'weekly', 'daily'
  availableBalance: numeric("available_balance").default("0"),
  pendingBalance: numeric("pending_balance").default("0"),
  totalEarnings: numeric("total_earnings").default("0"),
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
  // KYC fields
  driversLicenseNumber: z.string().optional(),
  driversLicenseExpiry: z.string().optional(),
  driversLicenseState: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  vehicleYear: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleColor: z.string().optional(),
  driversLicenseDoc: z.string().optional(),
  vehicleRegistrationDoc: z.string().optional(),
  insuranceDoc: z.string().optional(),
  profilePhotoDoc: z.string().optional(),
  // Contractor fields
  isContractorOnboarded: z.boolean().optional(),
  ssnLast4: z.string().length(4).optional(),
  taxClassification: z.enum(["individual", "sole_proprietor", "llc", "corporation"]).optional(),
  businessName: z.string().optional(),
  taxAddress: z.string().optional(),
  taxCity: z.string().optional(),
  taxState: z.string().optional(),
  taxZip: z.string().optional(),
});

export const kycStatuses = ["not_submitted", "pending_review", "approved", "rejected"] as const;
export type KycStatus = typeof kycStatuses[number];
export type InsertDriverProfile = z.infer<typeof insertDriverProfileSchema>;
export type DriverProfile = typeof driverProfiles.$inferSelect;

export const paymentTypes = ["self_pay", "insurance"] as const;
export type PaymentType = typeof paymentTypes[number];

export const rides = pgTable("rides", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  patientId: integer("patient_id").references(() => patientProfiles.id),
  driverId: integer("driver_id").references(() => driverProfiles.id),
  patientName: text("patient_name").notNull(),
  patientPhone: text("patient_phone").notNull(),
  patientEmail: text("patient_email"),
  // Booker info (for family member booking on behalf of patient)
  bookedByOther: boolean("booked_by_other").default(false),
  bookerName: text("booker_name"),
  bookerPhone: text("booker_phone"),
  bookerEmail: text("booker_email"),
  bookerRelation: text("booker_relation"), // 'spouse', 'child', 'parent', 'caregiver', 'other'
  pickupAddress: text("pickup_address").notNull(),
  pickupLat: numeric("pickup_lat").notNull(),
  pickupLng: numeric("pickup_lng").notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  dropoffLat: numeric("dropoff_lat").notNull(),
  dropoffLng: numeric("dropoff_lng").notNull(),
  appointmentTime: timestamp("appointment_time").notNull(),
  mobilityNeeds: text("mobility_needs").array().default([]),
  notes: text("notes"),
  distanceMiles: numeric("distance_miles"),
  estimatedFare: numeric("estimated_fare"),
  paymentType: text("payment_type").notNull().default("self_pay"),
  insuranceProvider: text("insurance_provider"),
  memberId: text("member_id"),
  groupNumber: text("group_number"),
  priorAuthNumber: text("prior_auth_number"),
  status: text("status").notNull().default("requested"),
  verificationCode: text("verification_code"),
  emergencyContactShared: boolean("emergency_contact_shared").default(false),
  estimatedArrivalTime: timestamp("estimated_arrival_time"),
  // Cancellation fields
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: text("cancelled_by"), // 'patient', 'driver', 'system'
  cancellationReason: text("cancellation_reason"),
  cancellationFee: numeric("cancellation_fee"),
  // Surge/peak pricing
  surgeMultiplier: numeric("surge_multiplier").default("1.0"),
  baseFare: numeric("base_fare"),
  // Tolls
  estimatedTolls: numeric("estimated_tolls").default("0"),
  actualTolls: numeric("actual_tolls"),
  // Traffic and delays
  delayMinutes: integer("delay_minutes").default(0),
  delayReason: text("delay_reason"),
  trafficCondition: text("traffic_condition"), // 'normal', 'moderate', 'heavy'
  // Payment tracking
  paymentStatus: text("payment_status").default("pending"), // 'pending', 'paid', 'processing', 'completed', 'failed', 'refunded'
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAmount: numeric("paid_amount"),
  paymentAttempts: integer("payment_attempts").default(0),
  paymentFailedAt: timestamp("payment_failed_at"),
  finalFare: numeric("final_fare"),
  // Platform commission (15% self-pay, 10% insurance)
  platformFeePercent: numeric("platform_fee_percent").default("15"),
  platformFee: numeric("platform_fee").default("0"),
  driverEarnings: numeric("driver_earnings").default("0"),
  // Tips
  tipAmount: numeric("tip_amount").default("0"),
  tipPaidAt: timestamp("tip_paid_at"),
  // Actual trip data
  actualPickupTime: timestamp("actual_pickup_time"),
  actualDropoffTime: timestamp("actual_dropoff_time"),
  actualDistanceMiles: numeric("actual_distance_miles"),
  // Journey monitoring
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  isAbandonedWarning: boolean("is_abandoned_warning").default(false),
  // Secure tracking token for patient access (expires when ride completes/cancels)
  trackingToken: text("tracking_token"),
  trackingTokenExpiresAt: timestamp("tracking_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRideSchema = z.object({
  patientId: z.number().optional(),
  driverId: z.number().optional(),
  patientName: z.string().min(1),
  patientPhone: z.string().min(1),
  patientEmail: z.string().email().optional(),
  // Booker info (for family member booking on behalf of patient)
  bookedByOther: z.boolean().optional().default(false),
  bookerName: z.string().optional(),
  bookerPhone: z.string().optional(),
  bookerEmail: z.string().email().optional(),
  bookerRelation: z.enum(["spouse", "child", "parent", "caregiver", "other"]).optional(),
  pickupAddress: z.string().min(1),
  pickupLat: z.string(),
  pickupLng: z.string(),
  dropoffAddress: z.string().min(1),
  dropoffLat: z.string(),
  dropoffLng: z.string(),
  appointmentTime: z.coerce.date(),
  mobilityNeeds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  distanceMiles: z.string().optional(),
  estimatedFare: z.string().optional(),
  paymentType: z.enum(["self_pay", "insurance"]).default("self_pay"),
  insuranceProvider: z.string().optional(),
  memberId: z.string().optional(),
  groupNumber: z.string().optional(),
  priorAuthNumber: z.string().optional(),
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

export const rideMessages = pgTable("ride_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rideId: integer("ride_id").references(() => rides.id).notNull(),
  senderType: text("sender_type").notNull(),
  message: text("message").notNull(),
  isQuickMessage: boolean("is_quick_message").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRideMessageSchema = z.object({
  rideId: z.number(),
  senderType: z.enum(["driver", "patient"]),
  message: z.string().min(1),
  isQuickMessage: z.boolean().optional(),
});
export type InsertRideMessage = z.infer<typeof insertRideMessageSchema>;
export type RideMessage = typeof rideMessages.$inferSelect;

export const tripShares = pgTable("trip_shares", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rideId: integer("ride_id").references(() => rides.id).notNull(),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email"),
  shareCode: text("share_code").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTripShareSchema = z.object({
  rideId: z.number(),
  contactName: z.string().min(1),
  contactPhone: z.string().min(1),
  contactEmail: z.string().email().optional(),
});
export type InsertTripShare = z.infer<typeof insertTripShareSchema>;
export type TripShare = typeof tripShares.$inferSelect;

// Surge pricing configuration
export const surgePricing = pgTable("surge_pricing", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  startHour: integer("start_hour").notNull(), // 0-23
  endHour: integer("end_hour").notNull(), // 0-23
  multiplier: numeric("multiplier").notNull().default("1.0"),
  isActive: boolean("is_active").default(true),
  reason: text("reason"), // 'peak_hours', 'holiday', 'high_demand'
});

export type SurgePricing = typeof surgePricing.$inferSelect;

// Toll zones for route estimation
export const tollZones = pgTable("toll_zones", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  tollAmount: numeric("toll_amount").notNull(),
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  radiusMiles: numeric("radius_miles").notNull().default("5"),
  isActive: boolean("is_active").default(true),
});

export type TollZone = typeof tollZones.$inferSelect;

// Patient account status for payment tracking
export const patientAccounts = pgTable("patient_accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  patientPhone: text("patient_phone").notNull().unique(),
  patientName: text("patient_name"),
  accountStatus: text("account_status").default("good_standing"), // 'good_standing', 'warning', 'restricted', 'blocked'
  outstandingBalance: numeric("outstanding_balance").default("0"),
  cancellationCount: integer("cancellation_count").default(0),
  totalRidesCompleted: integer("total_rides_completed").default(0),
  totalRidesCancelled: integer("total_rides_cancelled").default(0),
  emergencyOverrideCount: integer("emergency_override_count").default(0),
  lastEmergencyOverride: timestamp("last_emergency_override"),
  lastPaymentDate: timestamp("last_payment_date"),
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PatientAccount = typeof patientAccounts.$inferSelect;

// Cancellation policies
export const cancellationPolicies = pgTable("cancellation_policies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  description: text("description"),
  freeMinutesAfterBooking: integer("free_minutes_after_booking").default(5),
  freeMinutesAfterDriverAssigned: integer("free_minutes_after_driver_assigned").default(2),
  cancellationFeeAmount: numeric("cancellation_fee_amount").default("10"),
  cancellationFeePercent: numeric("cancellation_fee_percent"), // Alternative: percentage of fare
  driverNoShowMinutes: integer("driver_no_show_minutes").default(15),
  patientNoShowMinutes: integer("patient_no_show_minutes").default(10),
  isActive: boolean("is_active").default(true),
});

export type CancellationPolicy = typeof cancellationPolicies.$inferSelect;

// Driver ratings
export const rideRatings = pgTable("ride_ratings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rideId: integer("ride_id").references(() => rides.id).notNull(),
  ratedBy: text("rated_by").notNull(), // 'patient' or 'driver'
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRideRatingSchema = z.object({
  rideId: z.number(),
  ratedBy: z.enum(["patient", "driver"]),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});
export type InsertRideRating = z.infer<typeof insertRideRatingSchema>;
export type RideRating = typeof rideRatings.$inferSelect;

// Annual earnings summary for 1099 generation
export const annualEarnings = pgTable("annual_earnings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driver_id").references(() => driverProfiles.id).notNull(),
  taxYear: integer("tax_year").notNull(),
  totalGrossEarnings: numeric("total_gross_earnings").default("0"),
  totalTips: numeric("total_tips").default("0"),
  totalTolls: numeric("total_tolls").default("0"),
  totalRides: integer("total_rides").default(0),
  totalMiles: numeric("total_miles").default("0"),
  form1099Generated: boolean("form_1099_generated").default(false),
  form1099GeneratedAt: timestamp("form_1099_generated_at"),
  form1099DownloadCount: integer("form_1099_download_count").default(0),
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AnnualEarnings = typeof annualEarnings.$inferSelect;

// Contractor agreement acceptance log
export const contractorAgreements = pgTable("contractor_agreements", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driver_id").references(() => driverProfiles.id).notNull(),
  agreementVersion: text("agreement_version").notNull().default("1.0"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  signedAt: timestamp("signed_at").defaultNow(),
});

export type ContractorAgreement = typeof contractorAgreements.$inferSelect;

// Incident reports for ride-related issues (accidents, safety concerns, etc.)
export const incidentReports = pgTable("incident_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  rideId: integer("ride_id").references(() => rides.id),
  reporterId: integer("reporter_id"), // Can be patientId or driverId depending on reporterType
  reporterType: text("reporter_type").notNull(), // 'patient' or 'driver'
  reporterName: text("reporter_name").notNull(),
  reporterPhone: text("reporter_phone").notNull(),
  reporterEmail: text("reporter_email"),
  category: text("category").notNull(), // 'accident', 'driver_behavior', 'vehicle_issue', 'safety_concern', 'billing', 'other'
  severity: text("severity").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  description: text("description").notNull(),
  location: text("location"),
  incidentDate: timestamp("incident_date"),
  evidenceUrls: text("evidence_urls").array().default([]), // Photo/document uploads
  status: text("status").notNull().default("open"), // 'open', 'investigating', 'resolved', 'closed'
  adminNotes: text("admin_notes"),
  assignedTo: text("assigned_to"),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIncidentReportSchema = z.object({
  rideId: z.number().optional(),
  reporterId: z.number().optional(),
  reporterType: z.enum(["patient", "driver"]),
  reporterName: z.string().min(1),
  reporterPhone: z.string().min(1),
  reporterEmail: z.string().email().optional(),
  category: z.enum(["accident", "driver_behavior", "vehicle_issue", "safety_concern", "billing", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  description: z.string().min(10),
  location: z.string().optional(),
  incidentDate: z.coerce.date().optional(),
});
export type InsertIncidentReport = z.infer<typeof insertIncidentReportSchema>;
export type IncidentReport = typeof incidentReports.$inferSelect;

// Driver payouts tracking
export const driverPayouts = pgTable("driver_payouts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  driverId: integer("driver_id").references(() => driverProfiles.id).notNull(),
  amount: numeric("amount").notNull(),
  fee: numeric("fee").default("0"), // Platform/processing fee
  netAmount: numeric("net_amount").notNull(), // Amount after fees
  method: text("method").notNull().default("standard"), // 'instant', 'standard'
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  stripePayoutId: text("stripe_payout_id"),
  stripeTransferId: text("stripe_transfer_id"),
  destinationLast4: text("destination_last4"), // Last 4 of bank account
  failureReason: text("failure_reason"),
  requestedAt: timestamp("requested_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
});

export const insertDriverPayoutSchema = z.object({
  driverId: z.number(),
  amount: z.string(),
  method: z.enum(["instant", "standard"]).optional(),
});
export type InsertDriverPayout = z.infer<typeof insertDriverPayoutSchema>;
export type DriverPayout = typeof driverPayouts.$inferSelect;

export const payoutMethods = ["instant", "standard"] as const;
export type PayoutMethod = typeof payoutMethods[number];

export const payoutStatuses = ["pending", "processing", "completed", "failed"] as const;
export type PayoutStatus = typeof payoutStatuses[number];
