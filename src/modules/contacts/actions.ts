"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { findDuplicateContacts } from "./queries";
import { contacts } from "./schema";
import { contactInputFromForm, contactInputSchema, normalizePhone } from "./validation";

export type ContactFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Nomes de contactos já existentes com o mesmo telefone/NIF. */
  duplicates?: string[];
};

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const user = await requireUser();
  const parsed = contactInputSchema.safeParse(contactInputFromForm(formData));
  if (!parsed.success) {
    return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const data = parsed.data;
  const phoneNormalized = normalizePhone(data.phone);

  // Aviso de duplicado: só bloqueia se o utilizador ainda não confirmou.
  if (formData.get("confirmDuplicate") !== "1") {
    const dups = await findDuplicateContacts(user.organizationId, {
      phoneNormalized,
      nif: data.nif ?? null,
    });
    if (dups.length > 0) {
      return {
        error: "Já existe um contacto com este telefone ou NIF.",
        duplicates: dups.map((d) => d.name),
      };
    }
  }

  const [created] = await db
    .insert(contacts)
    .values({
      organizationId: user.organizationId,
      ...data,
      phoneNormalized,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: contacts.id });

  revalidatePath("/contacts");
  redirect(`/contacts/${created!.id}`);
}

export async function updateContact(
  id: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const user = await requireUser();
  const parsed = contactInputSchema.safeParse(contactInputFromForm(formData));
  if (!parsed.success) {
    return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const data = parsed.data;
  const phoneNormalized = normalizePhone(data.phone);

  if (formData.get("confirmDuplicate") !== "1") {
    const dups = await findDuplicateContacts(user.organizationId, {
      phoneNormalized,
      nif: data.nif ?? null,
      excludeId: id,
    });
    if (dups.length > 0) {
      return {
        error: "Já existe outro contacto com este telefone ou NIF.",
        duplicates: dups.map((d) => d.name),
      };
    }
  }

  await db
    .update(contacts)
    .set({ ...data, phoneNormalized, updatedBy: user.id })
    .where(and(eq(contacts.id, id), eq(contacts.organizationId, user.organizationId)));

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

/** Soft delete. Só admin e manager. */
export async function deleteContact(id: string): Promise<void> {
  const user = await requireUser();
  if (user.role === "user") throw new Error("Sem permissão para eliminar contactos.");

  await db
    .update(contacts)
    .set({ deletedAt: new Date(), updatedBy: user.id })
    .where(and(eq(contacts.id, id), eq(contacts.organizationId, user.organizationId)));

  revalidatePath("/contacts");
  redirect("/contacts");
}
