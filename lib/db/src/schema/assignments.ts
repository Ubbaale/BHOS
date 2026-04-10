import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";
import { homesTable } from "./homes";

export const dailyAssignmentsTable = pgTable("daily_assignments", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  homeId: integer("home_id").notNull().references(() => homesTable.id),
  assignmentDate: timestamp("assignment_date", { withTimezone: true }).notNull(),
  shiftType: text("shift_type").notNull().default("day"),
  patientIds: text("patient_ids").notNull(),
  assignedTasks: text("assigned_tasks"),
  specialInstructions: text("special_instructions"),
  status: text("status").notNull().default("active"),
  clockedInAt: timestamp("clocked_in_at", { withTimezone: true }),
  clockedOutAt: timestamp("clocked_out_at", { withTimezone: true }),
  assignedBy: text("assigned_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyAssignmentSchema = createInsertSchema(dailyAssignmentsTable).omit({ id: true, createdAt: true });
export type InsertDailyAssignment = z.infer<typeof insertDailyAssignmentSchema>;
export type DailyAssignment = typeof dailyAssignmentsTable.$inferSelect;
