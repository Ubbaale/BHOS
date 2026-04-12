import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { staffTable } from "./staff";
import { patientsTable } from "./patients";

export const customFormsTable = pgTable("custom_forms", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("assessment"),
  formSchema: text("form_schema").notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  isRequired: boolean("is_required").notNull().default(false),
  frequency: text("frequency"),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"),
  createdBy: integer("created_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const formSubmissionsTable = pgTable("form_submissions", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => customFormsTable.id),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  submittedBy: integer("submitted_by").references(() => staffTable.id),
  formData: text("form_data").notNull(),
  status: text("status").notNull().default("submitted"),
  reviewedBy: integer("reviewed_by").references(() => staffTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomFormSchema = createInsertSchema(customFormsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomForm = z.infer<typeof insertCustomFormSchema>;
export type CustomForm = typeof customFormsTable.$inferSelect;

export const insertFormSubmissionSchema = createInsertSchema(formSubmissionsTable).omit({ id: true, submittedAt: true });
export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissionsTable.$inferSelect;
