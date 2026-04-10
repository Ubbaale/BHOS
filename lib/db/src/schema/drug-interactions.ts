import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const drugInteractionsTable = pgTable("drug_interactions", {
  id: serial("id").primaryKey(),
  drugA: text("drug_a").notNull(),
  drugB: text("drug_b").notNull(),
  severity: text("severity").notNull().default("moderate"),
  description: text("description").notNull(),
  recommendation: text("recommendation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDrugInteractionSchema = createInsertSchema(drugInteractionsTable).omit({ id: true, createdAt: true });
export type InsertDrugInteraction = z.infer<typeof insertDrugInteractionSchema>;
export type DrugInteraction = typeof drugInteractionsTable.$inferSelect;
