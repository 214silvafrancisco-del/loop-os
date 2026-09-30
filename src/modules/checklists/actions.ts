"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { getChecklistItemOwner } from "./queries";
import { checklistItems, type ChecklistEntityType } from "./schema";
import { syncChecklist } from "./sync";

type Result = { ok: true } | { ok: false; error: string };

function entityPath(entityType: ChecklistEntityType, entityId: string) {
  return entityType === "deal" ? `/deals/${entityId}` : `/projects/${entityId}`;
}

const statusSchema = z.object({
  status: z.enum(["pending", "done", "not_applicable"]),
  note: z.string().trim().max(500).optional(),
});

/**
 * Marca um item à mão. Itens manuais aceitam qualquer estado; itens
 * automáticos só "não aplicável" (com nota) ou voltar a pendente, porque o
 * "concluído" deles vem dos dados.
 */
export async function setChecklistItemStatus(itemId: string, input: { status: string; note?: string }): Promise<Result> {
  const user = await requireUser();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Estado inválido." };
  const { status, note } = parsed.data;

  const owner = await getChecklistItemOwner(itemId);
  if (!owner || owner.organizationId !== user.organizationId) return { ok: false, error: "Item não encontrado." };
  if (owner.kind === "auto" && status === "done") return { ok: false, error: "Este passo conclui-se automaticamente a partir dos dados." };

  const now = new Date();
  await db
    .update(checklistItems)
    .set({
      status,
      source: "manual",
      completedAt: status === "done" ? now : null,
      completedBy: status === "done" ? user.id : null,
      naNote: status === "not_applicable" ? (note ?? null) : null,
      updatedBy: user.id,
    })
    .where(eq(checklistItems.id, itemId));

  await syncChecklist(user.organizationId, owner.entityType, owner.entityId, user.id);
  revalidatePath(entityPath(owner.entityType, owner.entityId), "layout");
  revalidatePath(owner.entityType === "deal" ? "/deals" : "/projects");
  return { ok: true };
}

export async function assignChecklistItem(itemId: string, assigneeUserId: string | null): Promise<Result> {
  const user = await requireUser();
  if (assigneeUserId && !z.uuid().safeParse(assigneeUserId).success) return { ok: false, error: "Utilizador inválido." };
  const owner = await getChecklistItemOwner(itemId);
  if (!owner || owner.organizationId !== user.organizationId) return { ok: false, error: "Item não encontrado." };
  await db.update(checklistItems).set({ assigneeUserId, updatedBy: user.id }).where(eq(checklistItems.id, itemId));
  revalidatePath(entityPath(owner.entityType, owner.entityId), "layout");
  return { ok: true };
}

/** Sincroniza a partir da UI (ex.: ao abrir a tab Processo). */
export async function refreshChecklist(entityType: ChecklistEntityType, entityId: string): Promise<Result> {
  const user = await requireUser();
  const r = await syncChecklist(user.organizationId, entityType, entityId, user.id);
  if (!r) return { ok: false, error: "Não foi possível sincronizar." };
  revalidatePath(entityPath(entityType, entityId), "layout");
  return { ok: true };
}
