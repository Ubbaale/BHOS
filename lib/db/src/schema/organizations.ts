import { pgTable, text, serial, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  planTier: text("plan_tier").notNull().default("starter"),
  status: text("status").notNull().default("active"),
  logoUrl: text("logo_url"),
  website: text("website"),
  taxId: text("tax_id"),
  npi: text("npi"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  planType: text("plan_type").notNull().default("professional"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  pricePerHome: numeric("price_per_home", { precision: 10, scale: 2 }).notNull().default("299.00"),
  homeLimit: integer("home_limit").notNull().default(5),
  currentHomeCount: integer("current_home_count").notNull().default(0),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  graceEndDate: timestamp("grace_end_date", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  autoRenew: boolean("auto_renew").notNull().default(true),
  lastPaymentDate: timestamp("last_payment_date", { withTimezone: true }),
  nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
  paymentMethod: text("payment_method"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  cancelReason: text("cancel_reason"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const licenseEventsTable = pgTable("license_events", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  subscriptionId: integer("subscription_id").references(() => subscriptionsTable.id),
  eventType: text("event_type").notNull(),
  details: text("details"),
  notificationSent: boolean("notification_sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

export const insertLicenseEventSchema = createInsertSchema(licenseEventsTable).omit({ id: true, createdAt: true });
export type InsertLicenseEvent = z.infer<typeof insertLicenseEventSchema>;
export type LicenseEvent = typeof licenseEventsTable.$inferSelect;
