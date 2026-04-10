import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const superAdminsTable = pgTable("super_admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("support"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
