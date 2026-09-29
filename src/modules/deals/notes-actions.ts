"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { dealNotes, deals } from "./schema";

export type NoteFormState = { error?: string; body?: string };

const bodySchema = z.string().trim().min(1, "Escreve alguma coisa.").max(10000, "Nota demasiado longa.");

export async function addDealNote(dealId: string, _prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const user = await requireUser();
  const raw = String(formData.get("body") ?? "");
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message, body: raw };

  const [deal] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, user.organizationId)));
  if (!deal) return { error: "Negócio não encontrado.", body: raw };

  await db.insert(dealNotes).values({
    organizationId: user.organizationId,
    dealId,
    body: parsed.data,
    createdBy: user.id,
    updatedBy: user.id,
  });
  revalidatePath(`/deals/${dealId}/notas`);
  return {};
}

export async function toggleNotePinned(noteId: string, dealId: string): Promise<void> {
  const user = await requireUser();
  const [note] = await db
    .select({ isPinned: dealNotes.isPinned })
    .from(dealNotes)
    .where(and(eq(dealNotes.id, noteId), eq(dealNotes.organizationId, user.organizationId)));
  if (!note) return;
  await db
    .update(dealNotes)
    .set({ isPinned: !note.isPinned, updatedBy: user.id })
    .where(eq(dealNotes.id, noteId));
  revalidatePath(`/deals/${dealId}/notas`);
}

/** O autor apaga as suas; admin e manager apagam qualquer uma. */
export async function deleteDealNote(noteId: string, dealId: string): Promise<void> {
  const user = await requireUser();
  const [note] = await db
    .select({ createdBy: dealNotes.createdBy })
    .from(dealNotes)
    .where(and(eq(dealNotes.id, noteId), eq(dealNotes.organizationId, user.organizationId)));
  if (!note) return;
  if (note.createdBy !== user.id && user.role === "user") throw new Error("Sem permissão para apagar esta nota.");
  await db.delete(dealNotes).where(eq(dealNotes.id, noteId));
  revalidatePath(`/deals/${dealId}/notas`);
}
