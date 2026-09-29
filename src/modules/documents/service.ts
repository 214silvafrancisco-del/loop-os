import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { getStorage, safeFileName } from "@/core/storage";
import { documents, documentVersions, type Document } from "./schema";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Tipos aceites no MVP. DWG entra como download sem preview. */
export const ALLOWED_MIME: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/msword": [".doc"],
  "application/vnd.ms-excel": [".xls"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
  "application/acad": [".dwg"],
  "image/vnd.dwg": [".dwg"],
  "application/octet-stream": [".dwg", ".zip"],
};

export function mimeFromName(fileName: string, declared: string): string {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
  if (declared && ALLOWED_MIME[declared]?.includes(ext)) return declared;
  for (const [mime, exts] of Object.entries(ALLOWED_MIME)) {
    if (mime !== "application/octet-stream" && exts.includes(ext)) return mime;
  }
  return "";
}

export function isPreviewable(mime: string) {
  return mime === "application/pdf" || mime.startsWith("image/");
}

type Actor = { id: string; organizationId: string };

type CreateInput = {
  propertyId: string;
  entityType: Document["entityType"];
  entityId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  docDate: string | null;
};

type FileInput = { fileName: string; mimeType: string; bytes: Uint8Array };

function storageKey(propertyId: string, entityType: string, documentId: string, versionNo: number, fileName: string) {
  return `properties/${propertyId}/${entityType}/${documentId}/v${versionNo}/${safeFileName(fileName)}`;
}

/** Cria o documento e a versão 1, guardando o ficheiro no storage. */
export async function createDocumentWithFile(user: Actor, input: CreateInput, file: FileInput) {
  const storage = getStorage();
  const checksum = createHash("sha256").update(file.bytes).digest("hex");

  return db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(documents)
      .values({ organizationId: user.organizationId, ...input, createdBy: user.id, updatedBy: user.id })
      .returning({ id: documents.id });
    const key = storageKey(input.propertyId, input.entityType, doc!.id, 1, file.fileName);
    await storage.putObject(key, file.bytes, file.mimeType);
    const [version] = await tx
      .insert(documentVersions)
      .values({
        documentId: doc!.id,
        versionNo: 1,
        storageKey: key,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.bytes.byteLength,
        checksumSha256: checksum,
        uploadedBy: user.id,
      })
      .returning({ id: documentVersions.id });
    await tx.update(documents).set({ currentVersionId: version!.id }).where(eq(documents.id, doc!.id));
    return { documentId: doc!.id, versionId: version!.id };
  });
}

/** Nova versão de um documento existente; a anterior fica acessível no histórico. */
export async function addDocumentVersion(user: Actor, documentId: string, file: FileInput, note: string | null) {
  const storage = getStorage();
  const [doc] = await db
    .select({ id: documents.id, propertyId: documents.propertyId, entityType: documents.entityType })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, user.organizationId), isNull(documents.deletedAt)));
  if (!doc) throw new Error("Documento não encontrado.");
  const checksum = createHash("sha256").update(file.bytes).digest("hex");

  return db.transaction(async (tx) => {
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${documentVersions.versionNo}), 0)::int + 1` })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId));
    const key = storageKey(doc.propertyId, doc.entityType, doc.id, next, file.fileName);
    await storage.putObject(key, file.bytes, file.mimeType);
    const [version] = await tx
      .insert(documentVersions)
      .values({
        documentId,
        versionNo: next,
        storageKey: key,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.bytes.byteLength,
        checksumSha256: checksum,
        note,
        uploadedBy: user.id,
      })
      .returning({ id: documentVersions.id });
    await tx.update(documents).set({ currentVersionId: version!.id, updatedBy: user.id }).where(eq(documents.id, documentId));
    return { documentId, versionId: version!.id, versionNo: next };
  });
}
