import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { homesTable } from "./homes";
import { organizationsTable } from "./organizations";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  role: text("role").notNull().default("caregiver"),
  homeId: integer("home_id").references(() => homesTable.id),
  orgId: integer("org_id").references(() => organizationsTable.id),
  clerkUserId: text("clerk_user_id"),
  status: text("status").notNull().default("active"),
  employeeType: text("employee_type").notNull().default("permanent"),
  agencyName: text("agency_name"),
  contractEndDate: timestamp("contract_end_date", { withTimezone: true }),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  hireDate: timestamp("hire_date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
