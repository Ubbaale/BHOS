import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";
import { homesTable } from "./homes";

export const staffMessagesTable = pgTable("staff_messages", {
  id: serial("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  homeId: integer("home_id").references(() => homesTable.id),
  senderId: integer("sender_id").notNull().references(() => staffTable.id),
  senderName: text("sender_name").notNull(),
  receiverId: integer("receiver_id").references(() => staffTable.id),
  receiverName: text("receiver_name"),
  message: text("message").notNull(),
  urgency: text("urgency").notNull().default("normal"),
  messageType: text("message_type").notNull().default("direct"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStaffMessageSchema = createInsertSchema(staffMessagesTable).omit({ id: true, createdAt: true, readAt: true });
export type InsertStaffMessage = z.infer<typeof insertStaffMessageSchema>;
export type StaffMessage = typeof staffMessagesTable.$inferSelect;
