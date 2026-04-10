import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";
import { organizationsTable } from "./organizations";

export const trainingCoursesTable = pgTable("training_courses", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  isRequired: boolean("is_required").notNull().default(false),
  renewalMonths: integer("renewal_months"),
  durationHours: integer("duration_hours"),
  provider: text("provider"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffCertificationsTable = pgTable("staff_certifications", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  courseId: integer("course_id").references(() => trainingCoursesTable.id),
  certificationName: text("certification_name").notNull(),
  certificationNumber: text("certification_number"),
  issuingOrganization: text("issuing_organization"),
  earnedDate: timestamp("earned_date", { withTimezone: true }).notNull(),
  expirationDate: timestamp("expiration_date", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  documentUrl: text("document_url"),
  notes: text("notes"),
  verifiedBy: integer("verified_by").references(() => staffTable.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trainingRecordsTable = pgTable("training_records", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  courseId: integer("course_id").notNull().references(() => trainingCoursesTable.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  score: integer("score"),
  passFail: text("pass_fail"),
  hoursCompleted: integer("hours_completed"),
  instructor: text("instructor"),
  method: text("method").notNull().default("in_person"),
  status: text("status").notNull().default("assigned"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrainingCourseSchema = createInsertSchema(trainingCoursesTable).omit({ id: true, createdAt: true });
export type InsertTrainingCourse = z.infer<typeof insertTrainingCourseSchema>;
export type TrainingCourse = typeof trainingCoursesTable.$inferSelect;

export const insertStaffCertificationSchema = createInsertSchema(staffCertificationsTable).omit({ id: true, createdAt: true });
export type InsertStaffCertification = z.infer<typeof insertStaffCertificationSchema>;
export type StaffCertification = typeof staffCertificationsTable.$inferSelect;

export const insertTrainingRecordSchema = createInsertSchema(trainingRecordsTable).omit({ id: true, createdAt: true });
export type InsertTrainingRecord = z.infer<typeof insertTrainingRecordSchema>;
export type TrainingRecord = typeof trainingRecordsTable.$inferSelect;
