import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const medAccessChallengesTable = pgTable("med_access_challenges", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id")
    .notNull()
    .references(() => staffTable.id),
  challengeType: text("challenge_type").notNull().default("medication_admin"),
  status: text("status").notNull().default("pending"),
  deviceInfo: text("device_info"),
  patientName: text("patient_name"),
  medicationName: text("medication_name"),
  responseSecret: text("response_secret").notNull(),
  approvalToken: text("approval_token"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
