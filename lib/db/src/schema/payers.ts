import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payersTable = pgTable("payers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("commercial"),
  payerId: text("payer_id"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  contactName: text("contact_name"),
  website: text("website"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPayerSchema = createInsertSchema(payersTable).omit({ id: true, createdAt: true });
export type InsertPayer = z.infer<typeof insertPayerSchema>;
export type Payer = typeof payersTable.$inferSelect;
