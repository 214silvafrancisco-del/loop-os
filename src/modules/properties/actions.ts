"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { findPropertiesByAddress } from "./queries";
import { properties } from "./schema";
import {
  normalizeAddress,
  propertyInputFromForm,
  propertyInputSchema,
  type PropertyInput,
} from "./validation";

export type PropertyFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Refs de imóveis já existentes com a mesma morada. */
  duplicates?: string[];
  values?: PropertyInput;
};

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const user = await requireUser();
  const values = propertyInputFromForm(formData);
  const parsed = propertyInputSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues), values };
  }
  const data = parsed.data;
  const addressNormalized = normalizeAddress(data.addressLine, data.parish);

  if (formData.get("confirmDuplicate") !== "1") {
    const dups = await findPropertiesByAddress(user.organizationId, addressNormalized);
    if (dups.length > 0) {
      return {
        error: "Já existe um imóvel com esta morada.",
        duplicates: dups.map((d) => `${d.ref} · ${d.addressLine}`),
        values,
      };
    }
  }

  const [created] = await db
    .insert(properties)
    .values({
      organizationId: user.organizationId,
      ...data,
      addressNormalized,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: properties.id });

  revalidatePath("/properties");
  redirect(`/properties/${created!.id}`);
}

export async function updateProperty(
  id: string,
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const user = await requireUser();
  const values = propertyInputFromForm(formData);
  const parsed = propertyInputSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues), values };
  }
  const data = parsed.data;
  const addressNormalized = normalizeAddress(data.addressLine, data.parish);

  if (formData.get("confirmDuplicate") !== "1") {
    const dups = await findPropertiesByAddress(user.organizationId, addressNormalized, id);
    if (dups.length > 0) {
      return {
        error: "Já existe outro imóvel com esta morada.",
        duplicates: dups.map((d) => `${d.ref} · ${d.addressLine}`),
        values,
      };
    }
  }

  await db
    .update(properties)
    .set({ ...data, addressNormalized, updatedBy: user.id })
    .where(and(eq(properties.id, id), eq(properties.organizationId, user.organizationId)));

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  redirect(`/properties/${id}`);
}

/** Soft delete. Só admin e manager. (A partir do Step 06 bloqueia se tiver negócios.) */
export async function deleteProperty(id: string): Promise<void> {
  const user = await requireUser();
  if (user.role === "user") throw new Error("Sem permissão para eliminar imóveis.");

  await db
    .update(properties)
    .set({ deletedAt: new Date(), updatedBy: user.id })
    .where(and(eq(properties.id, id), eq(properties.organizationId, user.organizationId)));

  revalidatePath("/properties");
  redirect("/properties");
}
