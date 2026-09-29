"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { fieldErrorsOf } from "@/core/lib/form-schemas";
import { contacts } from "@/modules/contacts/schema";
import { normalizePhone } from "@/modules/contacts/validation";
import { findPropertiesByAddress } from "@/modules/properties/queries";
import { properties } from "@/modules/properties/schema";
import { normalizeAddress } from "@/modules/properties/validation";
import { dealStages } from "@/modules/settings/schema";
import { deals } from "./schema";
import {
  dealCreateInputFromForm,
  dealCreateSchema,
  dealUpdateInputFromForm,
  dealUpdateSchema,
  defaultDealName,
  imtResaleDeadline,
  type DealCreateInput,
  type DealUpdateInput,
} from "./validation";

export type DealFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Imóveis existentes com a mesma morada: o utilizador escolhe usar um ou criar novo. */
  duplicates?: { id: string; ref: string; addressLine: string; parish: string | null }[];
  values?: DealCreateInput | DealUpdateInput;
};

/**
 * Comprado ⇒ imóvel `owned`. Se o negócio sair da fase de compra e o imóvel
 * ainda não tiver obra, volta a `prospect`. (Obras chegam no Step 13.)
 */
async function syncPropertyStatus(propertyId: string, stageId: string) {
  const [stage] = await db.select({ isPurchase: dealStages.isPurchase }).from(dealStages).where(eq(dealStages.id, stageId));
  if (!stage) return;
  const [property] = await db.select({ status: properties.status }).from(properties).where(eq(properties.id, propertyId));
  if (!property) return;
  if (stage.isPurchase && property.status === "prospect") {
    await db.update(properties).set({ status: "owned" }).where(eq(properties.id, propertyId));
  } else if (!stage.isPurchase && property.status === "owned") {
    await db.update(properties).set({ status: "prospect" }).where(eq(properties.id, propertyId));
  }
}

export async function createDeal(_prev: DealFormState, formData: FormData): Promise<DealFormState> {
  const user = await requireUser();
  const values = dealCreateInputFromForm(formData);
  const parsed = dealCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues), values };
  }
  const d = parsed.data;
  const orgId = user.organizationId;

  // 1. Imóvel: reutilizar, avisar de duplicado, ou criar.
  let propertyId = d.existingPropertyId ?? null;
  if (!propertyId) {
    const addressNormalized = normalizeAddress(d.addressLine, d.parish);
    if (formData.get("confirmDuplicate") !== "1") {
      const dups = await findPropertiesByAddress(orgId, addressNormalized);
      if (dups.length > 0) {
        return {
          error: "Já existe um imóvel com esta morada. Usa-o ou cria um novo.",
          duplicates: dups.map((p) => ({ id: p.id, ref: p.ref, addressLine: p.addressLine, parish: p.parish })),
          values,
        };
      }
    }
  }

  // 2. Contacto novo (opcional).
  let sourceContactId = d.sourceContactId ?? null;
  if (!sourceContactId && d.newContactName) {
    const [c] = await db
      .insert(contacts)
      .values({
        organizationId: orgId,
        kind: d.newContactCompany ? "person" : "person",
        name: d.newContactName,
        roles: ["consultor"],
        companyName: d.newContactCompany ?? null,
        phone: d.newContactPhone ?? null,
        phoneNormalized: normalizePhone(d.newContactPhone),
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: contacts.id });
    sourceContactId = c!.id;
  }

  const dealId = await db.transaction(async (tx) => {
    if (!propertyId) {
      const [p] = await tx
        .insert(properties)
        .values({
          organizationId: orgId,
          propertyType: d.propertyType,
          addressLine: d.addressLine,
          addressNormalized: normalizeAddress(d.addressLine, d.parish),
          postalCode: d.postalCode ?? null,
          parish: d.parish ?? null,
          municipality: d.municipality ?? null,
          typology: d.typology ?? null,
          floor: d.floor ?? null,
          grossArea: d.grossArea ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: properties.id });
      propertyId = p!.id;
    }

    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${deals.seq}), 0)::int + 1` })
      .from(deals)
      .where(eq(deals.propertyId, propertyId));

    const [created] = await tx
      .insert(deals)
      .values({
        organizationId: orgId,
        propertyId,
        seq: next,
        name: d.name ?? defaultDealName(d),
        stageId: d.stageId,
        ownerUserId: d.ownerUserId ?? user.id,
        enteredAt: d.enteredAt ?? undefined,
        sourceChannelId: d.sourceChannelId ?? null,
        sourceContactId,
        listingUrl: d.listingUrl ?? null,
        sourceCommissionPct: d.sourceCommissionPct ?? null,
        sourceNotes: d.sourceNotes ?? null,
        nextAction: d.nextAction ?? null,
        nextActionDate: d.nextActionDate ?? null,
        askingPrice: d.askingPrice ?? null,
        targetPrice: d.targetPrice ?? null,
        maxPrice: d.maxPrice ?? null,
        estimatedWorks: d.estimatedWorks ?? null,
        estimatedSalePrice: d.estimatedSalePrice ?? null,
        finalPrice: d.finalPrice ?? null,
        cpcvDate: d.cpcvDate ?? null,
        deedDate: d.deedDate ?? null,
        actualAcquisitionCosts: d.actualAcquisitionCosts ?? null,
        imtResaleDeadline: imtResaleDeadline(d.deedDate),
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: deals.id });
    return created!.id;
  });

  await syncPropertyStatus(propertyId!, d.stageId);
  revalidatePath("/deals");
  revalidatePath("/properties");
  redirect(`/deals/${dealId}`);
}

export async function updateDeal(id: string, _prev: DealFormState, formData: FormData): Promise<DealFormState> {
  const user = await requireUser();
  const values = dealUpdateInputFromForm(formData);
  const parsed = dealUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues), values };
  }
  const d = parsed.data;

  const [existing] = await db
    .select({ propertyId: deals.propertyId })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.organizationId, user.organizationId), isNull(deals.deletedAt)));
  if (!existing) return { error: "Negócio não encontrado." };

  await db
    .update(deals)
    .set({
      ...d,
      enteredAt: d.enteredAt ?? undefined,
      imtResaleDeadline: imtResaleDeadline(d.deedDate),
      updatedBy: user.id,
    })
    .where(eq(deals.id, id));

  await syncPropertyStatus(existing.propertyId, d.stageId);
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  revalidatePath("/properties");
  redirect(`/deals/${id}`);
}

/** Excluir (sai do pipeline) ou reativar. Reversível. */
export async function setDealStatus(id: string, status: "active" | "excluded"): Promise<void> {
  const user = await requireUser();
  await db
    .update(deals)
    .set({
      status,
      excludedAt: status === "excluded" ? new Date() : null,
      updatedBy: user.id,
    })
    .where(and(eq(deals.id, id), eq(deals.organizationId, user.organizationId)));
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  redirect(`/deals/${id}`);
}
