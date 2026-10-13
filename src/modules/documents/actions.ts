"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasModule, moduleForEntity } from "@/core/auth/access";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { documents } from "./schema";

type Result = { ok: true } | { ok: false; error: string };

const metaSchema = z.object({
  name: z.string().trim().min(1, "Indica o nome.").max(200),
  categoryId: z.uuid().nullable(),
  docDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  description: z.string().trim().max(2000).nullable(),
});
export type DocumentMetaInput = z.input<typeof metaSchema>;

function revalidate() {
  revalidatePath("/deals", "layout");
  revalidatePath("/properties", "layout");
}

/** O documento pertence ao módulo do seu registo (negócio, obra, venda, imóvel…). */
async function canTouch(user: { organizationId: string; role: "admin" | "manager" | "user"; modules: readonly string[] }, documentId: string): Promise<boolean> {
  const [d] = await db.select({ entityType: documents.entityType }).from(documents).where(and(eq(documents.id, documentId), eq(documents.organizationId, user.organizationId)));
  return d ? hasModule(user as Parameters<typeof hasModule>[0], moduleForEntity(String(d.entityType))) : false;
}

export async function updateDocumentMeta(documentId: string, raw: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = metaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!(await canTouch(user, documentId))) return { ok: false, error: "Sem acesso ao módulo deste documento." };
  const res = await db
    .update(documents)
    .set({ ...parsed.data, updatedBy: user.id })
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, user.organizationId), isNull(documents.deletedAt)))
    .returning({ id: documents.id });
  if (!res.length) return { ok: false, error: "Documento não encontrado." };
  revalidate();
  return { ok: true };
}

/** Soft delete: o ficheiro fica no storage 30 dias (purga futura). */
export async function deleteDocument(documentId: string): Promise<Result> {
  const user = await requireUser();
  if (!(await canTouch(user, documentId))) return { ok: false, error: "Sem acesso ao módulo deste documento." };
  const res = await db
    .update(documents)
    .set({ deletedAt: new Date(), status: "archived", updatedBy: user.id })
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, user.organizationId), isNull(documents.deletedAt)))
    .returning({ id: documents.id });
  if (!res.length) return { ok: false, error: "Documento não encontrado." };
  revalidate();
  return { ok: true };
}
