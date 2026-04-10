import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("general"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  assignedTo: integer("assigned_to"),
  createdBy: integer("created_by").notNull(),
  createdByName: text("created_by_name"),
  createdByEmail: text("created_by_email"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportTicketMessagesTable = pgTable("support_ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => supportTicketsTable.id),
  senderType: text("sender_type").notNull().default("user"),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
