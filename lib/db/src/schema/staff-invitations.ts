import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const staffInvitationsTable = pgTable("staff_invitations", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  invitedBy: integer("invited_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
