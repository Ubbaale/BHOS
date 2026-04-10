import { pgTable, text, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const integrationSettingsTable = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  integrationType: text("integration_type").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config"),
  status: text("status").notNull().default("disconnected"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIntegrationSettingSchema = createInsertSchema(integrationSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationSetting = z.infer<typeof insertIntegrationSettingSchema>;
export type IntegrationSetting = typeof integrationSettingsTable.$inferSelect;
