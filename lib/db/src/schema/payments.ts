import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { claimsTable } from "./claims";
import { payersTable } from "./payers";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  claimId: integer("claim_id").notNull().references(() => claimsTable.id),
  payerId: integer("payer_id").references(() => payersTable.id),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
  amount: numeric("amount").notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("eft"),
  checkNumber: text("check_number"),
  eftTraceNumber: text("eft_trace_number"),
  adjustmentAmount: numeric("adjustment_amount").default("0"),
  adjustmentReason: text("adjustment_reason"),
  remarkCode: text("remark_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
