import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { staffTable } from "./staff";

export const progressNotesTable = pgTable("progress_notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  noteType: text("note_type").notNull().default("soap"),
  sessionType: text("session_type").notNull().default("individual"),
  sessionDate: timestamp("session_date", { withTimezone: true }).notNull(),
  duration: integer("duration"),
  subjective: text("subjective"),
  objective: text("objective"),
  assessment: text("assessment"),
  plan: text("plan"),
  behavior: text("behavior"),
  intervention: text("intervention"),
  response: text("response"),
  data: text("data"),
  action: text("action"),
  narrative: text("narrative"),
  treatmentPlanId: integer("treatment_plan_id"),
  goalIds: text("goal_ids"),
  moodRating: integer("mood_rating"),
  riskLevel: text("risk_level"),
  followUpNeeded: boolean("follow_up_needed").notNull().default(false),
  followUpDate: timestamp("follow_up_date", { withTimezone: true }),
  supervisorReview: boolean("supervisor_review").notNull().default(false),
  supervisorName: text("supervisor_name"),
  supervisorSignedAt: timestamp("supervisor_signed_at", { withTimezone: true }),
  signed: boolean("signed").notNull().default(false),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  status: text("status").notNull().default("draft"),
  addendum: text("addendum"),
  addendumDate: timestamp("addendum_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProgressNoteSchema = createInsertSchema(progressNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProgressNote = z.infer<typeof insertProgressNoteSchema>;
export type ProgressNote = typeof progressNotesTable.$inferSelect;
