import { pgTable, text, serial, integer, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";

export const familyMembersTable = pgTable("family_members", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  relationship: text("relationship").notNull(),
  accessLevel: text("access_level").notNull().default("read"),
  inviteCode: text("invite_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  notifyByEmail: boolean("notify_by_email").notNull().default(true),
  notifyBySms: boolean("notify_by_sms").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembersTable).omit({ id: true, createdAt: true, lastLoginAt: true });
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembersTable.$inferSelect;

export const familyNotificationsTable = pgTable("family_notifications", {
  id: serial("id").primaryKey(),
  familyMemberId: integer("family_member_id").notNull().references(() => familyMembersTable.id),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFamilyNotificationSchema = createInsertSchema(familyNotificationsTable).omit({ id: true, createdAt: true, readAt: true });
export type InsertFamilyNotification = z.infer<typeof insertFamilyNotificationSchema>;
export type FamilyNotification = typeof familyNotificationsTable.$inferSelect;

export const dailySummariesTable = pgTable("daily_summaries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  summaryDate: timestamp("summary_date", { withTimezone: true }).notNull(),
  moodOverall: text("mood_overall"),
  activitiesCompleted: text("activities_completed"),
  mealsEaten: text("meals_eaten"),
  sleepQuality: text("sleep_quality"),
  medicationAdherence: integer("medication_adherence"),
  incidentCount: integer("incident_count").notNull().default(0),
  vitalSignsSummary: text("vital_signs_summary"),
  staffNotes: text("staff_notes"),
  isPublishedToFamily: boolean("is_published_to_family").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  generatedBy: text("generated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailySummarySchema = createInsertSchema(dailySummariesTable).omit({ id: true, createdAt: true, publishedAt: true });
export type InsertDailySummary = z.infer<typeof insertDailySummarySchema>;
export type DailySummary = typeof dailySummariesTable.$inferSelect;

export const careMessagesTable = pgTable("care_messages", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  threadId: text("thread_id").notNull(),
  senderType: text("sender_type").notNull(),
  senderId: integer("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCareMessageSchema = createInsertSchema(careMessagesTable).omit({ id: true, createdAt: true, readAt: true });
export type InsertCareMessage = z.infer<typeof insertCareMessageSchema>;
export type CareMessage = typeof careMessagesTable.$inferSelect;

export const consentDocumentsTable = pgTable("consent_documents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  documentType: text("document_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  documentUrl: text("document_url"),
  status: text("status").notNull().default("pending"),
  signedBy: integer("signed_by").references(() => familyMembersTable.id),
  signedByName: text("signed_by_name"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConsentDocumentSchema = createInsertSchema(consentDocumentsTable).omit({ id: true, createdAt: true, signedAt: true });
export type InsertConsentDocument = z.infer<typeof insertConsentDocumentSchema>;
export type ConsentDocument = typeof consentDocumentsTable.$inferSelect;
