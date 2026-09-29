import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { documentCategories } from "@/modules/settings/schema";
import { documents, documentVersions, type Document, type DocumentVersion } from "./schema";

export type DocumentEntityType = Document["entityType"];

export type DocumentRow = {
  id: string;
  propertyId: string;
  entityType: DocumentEntityType;
  entityId: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryGroup: string | null;
  name: string;
  description: string | null;
  docDate: string | null;
  status: Document["status"];
  createdAt: Date;
  updatedAt: Date;
  versionId: string | null;
  versionNo: number | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: Date | null;
  uploaderName: string | null;
};

const selection = {
  id: documents.id,
  propertyId: documents.propertyId,
  entityType: documents.entityType,
  entityId: documents.entityId,
  categoryId: documents.categoryId,
  categoryName: documentCategories.name,
  categoryGroup: documentCategories.group,
  name: documents.name,
  description: documents.description,
  docDate: documents.docDate,
  status: documents.status,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
  versionId: documentVersions.id,
  versionNo: documentVersions.versionNo,
  fileName: documentVersions.fileName,
  mimeType: documentVersions.mimeType,
  sizeBytes: documentVersions.sizeBytes,
  uploadedAt: documentVersions.uploadedAt,
  uploaderName: profiles.fullName,
};

function base() {
  return db
    .select(selection)
    .from(documents)
    .leftJoin(documentVersions, eq(documents.currentVersionId, documentVersions.id))
    .leftJoin(documentCategories, eq(documents.categoryId, documentCategories.id))
    .leftJoin(profiles, eq(documentVersions.uploadedBy, profiles.id));
}

/** Todos os documentos de um imóvel (de todas as entidades), por categoria. */
export async function listDocumentsForProperty(organizationId: string, propertyId: string): Promise<DocumentRow[]> {
  return base()
    .where(and(eq(documents.organizationId, organizationId), eq(documents.propertyId, propertyId), isNull(documents.deletedAt)))
    .orderBy(asc(documentCategories.group), asc(documentCategories.sort), desc(documents.createdAt));
}

export async function getDocumentRow(organizationId: string, id: string): Promise<DocumentRow | null> {
  const [row] = await base()
    .where(and(eq(documents.organizationId, organizationId), eq(documents.id, id), isNull(documents.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listVersions(documentId: string): Promise<DocumentVersion[]> {
  return db.select().from(documentVersions).where(eq(documentVersions.documentId, documentId)).orderBy(desc(documentVersions.versionNo));
}

/** Versão + documento, com verificação de organização (para o download). */
export async function getVersionForDownload(organizationId: string, versionId: string) {
  const [row] = await db
    .select({
      version: documentVersions,
      documentId: documents.id,
      documentName: documents.name,
      deletedAt: documents.deletedAt,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(and(eq(documentVersions.id, versionId), eq(documents.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function listDocumentCategories(organizationId: string) {
  return db
    .select()
    .from(documentCategories)
    .where(and(eq(documentCategories.organizationId, organizationId), eq(documentCategories.isActive, true)))
    .orderBy(asc(documentCategories.group), asc(documentCategories.sort));
}
