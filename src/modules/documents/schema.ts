import {
  bigint,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { documentEntity } from "@/core/db/schema/enums";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";
import { properties } from "@/modules/properties/schema";
import { documentCategories } from "@/modules/settings/schema";

export const documentStatus = pgEnum("document_status", ["active", "superseded", "archived"]);

/**
 * Um documento lógico (a "Caderneta predial"), ligado sempre ao imóvel e à
 * entidade de contexto (negócio, obra, venda…). Os ficheiros vivem em
 * `document_versions`.
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    entityType: documentEntity("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    categoryId: uuid("category_id").references(() => documentCategories.id),
    name: text("name").notNull(),
    description: text("description"),
    docDate: date("doc_date"),
    status: documentStatus("status").notNull().default("active"),
    currentVersionId: uuid("current_version_id"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("documents_property_idx").on(t.propertyId),
    index("documents_entity_idx").on(t.entityType, t.entityId),
    index("documents_category_idx").on(t.categoryId),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksumSha256: text("checksum_sha256"),
    note: text("note"),
    uploadedBy: uuid("uploaded_by"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("document_versions_doc_no_idx").on(t.documentId, t.versionNo)],
);

export type Document = typeof documents.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
