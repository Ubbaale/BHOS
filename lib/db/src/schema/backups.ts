import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const dataBackupsTable = pgTable("data_backups", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  backupType: text("backup_type").notNull().default("full"),
  status: text("status").notNull().default("pending"),
  fileName: text("file_name"),
  fileSizeBytes: integer("file_size_bytes"),
  tableCount: integer("table_count"),
  recordCount: integer("record_count"),
  initiatedBy: text("initiated_by").notNull(),
  initiatedByType: text("initiated_by_type").notNull().default("user"),
  platformCopy: boolean("platform_copy").notNull().default(true),
  notes: text("notes"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
