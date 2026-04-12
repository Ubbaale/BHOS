import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { staffTable } from "./staff";
import { patientsTable } from "./patients";

export const documentFoldersTable = pgTable("document_folders", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  description: text("description"),
  createdBy: integer("created_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  folderId: integer("folder_id").references(() => documentFoldersTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  fileSizeBytes: integer("file_size_bytes"),
  category: text("category").notNull().default("general"),
  tags: text("tags"),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("active"),
  requiresSignature: boolean("requires_signature").notNull().default(false),
  uploadedBy: integer("uploaded_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentSignaturesTable = pgTable("document_signatures", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documentsTable.id),
  signedBy: integer("signed_by").references(() => staffTable.id),
  signerName: text("signer_name").notNull(),
  signerRole: text("signer_role"),
  signerEmail: text("signer_email"),
  signatureData: text("signature_data"),
  signatureType: text("signature_type").notNull().default("electronic"),
  ipAddress: text("ip_address"),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("completed"),
});

export const documentTemplatesTable = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id),
  name: text("name").notNull(),
  category: text("category").notNull().default("general"),
  content: text("content"),
  fields: text("fields"),
  requiresSignature: boolean("requires_signature").notNull().default(false),
  status: text("status").notNull().default("active"),
  createdBy: integer("created_by").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;

export const insertDocumentSignatureSchema = createInsertSchema(documentSignaturesTable).omit({ id: true, signedAt: true });
export type InsertDocumentSignature = z.infer<typeof insertDocumentSignatureSchema>;
export type DocumentSignature = typeof documentSignaturesTable.$inferSelect;

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplatesTable).omit({ id: true, createdAt: true });
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplatesTable.$inferSelect;

export const insertDocumentFolderSchema = createInsertSchema(documentFoldersTable).omit({ id: true, createdAt: true });
export type InsertDocumentFolder = z.infer<typeof insertDocumentFolderSchema>;
export type DocumentFolder = typeof documentFoldersTable.$inferSelect;
