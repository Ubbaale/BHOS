import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const jobs = pgTable("jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  facility: text("facility").notNull(),
  location: text("location").notNull(),
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  pay: text("pay").notNull(),
  shift: text("shift").notNull(),
  urgency: text("urgency").notNull(),
  requirements: text("requirements").array().notNull(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true }).extend({
  requirements: z.array(z.string()).min(1, "At least one requirement is required"),
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shiftId: text("shift_id").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull(),
  description: text("description").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("open"),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({ status: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;
