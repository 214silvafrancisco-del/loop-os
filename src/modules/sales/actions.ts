"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { dbErrorMessage } from "@/core/db/errors";
import { fieldErrorsOf } from "@/core/lib/form-schemas";
import { deals } from "@/modules/deals/schema";
import { projects } from "@/modules/projects/schema";
import { properties } from "@/modules/properties/schema";
import { dealStageSettings } from "./deal-stage";
import { dealStatusForStage, propertyStatusForStage } from "./constants";
import { getActiveSaleForProperty } from "./queries";
import { saleAgencies, saleLeads, sales, type SaleStage } from "./schema";
import {
  agencyInputFromForm,
  agencySchema,
  leadInputFromForm,
  leadSchema,
  nextActionSchema,
  saleInputFromForm,
  saleSchema,
  type AgencyInput,
  type LeadInput,
  type SaleInput,
} from "./validation";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type SaleFormState = { error?: string; fieldErrors?: Record<string, string>; values?: SaleInput };
export type AgencyFormState = { error?: string; fieldErrors?: Record<string, string>; values?: AgencyInput };
export type LeadFormState = { error?: string; fieldErrors?: Record<string, string>; values?: LeadInput };

function revalidateSale(id: string, propertyId?: string, dealId?: string | null) {
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`, "layout");
  revalidatePath("/dashboard");
  if (propertyId) revalidatePath(`/properties/${propertyId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`, "layout");
}

async function ownSale(organizationId: string, id: string) {
  const [s] = await db
    .select({ id: sales.id, propertyId: sales.propertyId, dealId: sales.dealId, stage: sales.stage, salePrice: sales.salePrice, deedDate: sales.deedDate })
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.organizationId, organizationId), isNull(sales.deletedAt)));
  return s ?? null;
}

/**
 * «Colocar à venda» no negócio comprado (fase de compra com escritura) ou
 * a partir da lista de vendas (imóvel detido sem venda ativa). Nasce em
 * Preparação com o preço de venda do cenário ativo como preço sugerido.
 */
export async function createSale(input: { dealId?: string; propertyId?: string }): Promise<{ ok: false; error: string } | never> {
  const user = await requireUser();
  const orgId = user.organizationId;
  let propertyId = input.propertyId ?? null;
  let dealId = input.dealId ?? null;
  let listingPrice: string | null = null;

  if (dealId) {
    const [row] = await db
      .select({ propertyId: deals.propertyId, deedDate: deals.deedDate, cpcvDate: deals.cpcvDate, status: deals.status, estimatedSalePrice: deals.estimatedSalePrice, stageId: deals.stageId })
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.organizationId, orgId), isNull(deals.deletedAt)));
    if (!row) return { ok: false, error: "Negócio não encontrado." };
    const stage = await dealStageSettings(row.stageId);
    // Basta o CPCV: há imóveis colocados à venda antes da escritura de compra.
    if (!stage?.isPurchase || !(row.cpcvDate || row.deedDate)) return { ok: false, error: "A venda só pode começar depois do CPCV ou da escritura de compra." };
    propertyId = row.propertyId;
    listingPrice = row.estimatedSalePrice;
  }
  if (!propertyId) return { ok: false, error: "Falta o imóvel." };

  const [property] = await db
    .select({ id: properties.id, status: properties.status })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.organizationId, orgId), isNull(properties.deletedAt)));
  if (!property) return { ok: false, error: "Imóvel não encontrado." };
  if (property.status !== "owned" && property.status !== "for_sale") return { ok: false, error: "Só se vendem imóveis detidos pela LOOP." };

  const existing = await getActiveSaleForProperty(orgId, propertyId);
  if (existing) redirect(`/sales/${existing.id}`);

  if (!dealId) {
    const [d] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.propertyId, propertyId), eq(deals.organizationId, orgId), isNull(deals.deletedAt), eq(deals.status, "active")))
      .orderBy(deals.seq)
      .limit(1);
    dealId = d?.id ?? null;
  }
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.propertyId, propertyId), eq(projects.organizationId, orgId), isNull(projects.deletedAt)))
    .limit(1);

  let created: { id: string } | undefined;
  try {
    [created] = await db
      .insert(sales)
      .values({ organizationId: orgId, propertyId, dealId, projectId: project?.id ?? null, ownerUserId: user.id, listingPrice, createdBy: user.id, updatedBy: user.id })
      .returning({ id: sales.id });
  } catch (e) {
    return { ok: false, error: dbErrorMessage(e) };
  }
  revalidateSale(created!.id, propertyId, dealId);
  redirect(`/sales/${created!.id}/resumo`);
}

export async function updateSale(id: string, _prev: SaleFormState, formData: FormData): Promise<SaleFormState> {
  const user = await requireUser();
  const values = saleInputFromForm(formData);
  const parsed = saleSchema.safeParse(values);
  if (!parsed.success) return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues), values };
  const sale = await ownSale(user.organizationId, id);
  if (!sale) return { error: "Venda não encontrada." };
  const d = parsed.data;
  try {
    await db
      .update(sales)
      .set({ ...d, otherSaleCosts: d.otherSaleCosts ?? "0", updatedBy: user.id })
      .where(eq(sales.id, id));
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidateSale(id, sale.propertyId, sale.dealId);
  redirect(`/sales/${id}/resumo`);
}

export type StageChangeResult = Result | { ok: false; needsClose: true; error: string };

/**
 * Muda a fase e propaga: imóvel (owned / for_sale / sold) e negócio de
 * origem (sold quando escriturado). «Vendido» exige preço e data da escritura.
 */
export async function changeSaleStage(id: string, stage: SaleStage, close?: { salePrice: string; deedDate: string }): Promise<StageChangeResult> {
  const user = await requireUser();
  const sale = await ownSale(user.organizationId, id);
  if (!sale) return { ok: false, error: "Venda não encontrada." };
  if (stage === sale.stage) return { ok: true };

  const patch: Partial<typeof sales.$inferInsert> = { stage, updatedBy: user.id };
  if (stage === "vendido") {
    const salePrice = close?.salePrice?.trim() ? close.salePrice : sale.salePrice;
    const deedDate = close?.deedDate?.trim() ? close.deedDate : sale.deedDate;
    if (!salePrice || !deedDate) return { ok: false, needsClose: true, error: "Para marcar como vendido indica o preço final e a data da escritura." };
    const parsed = saleSchema.pick({ salePrice: true, deedDate: true }).safeParse({ salePrice, deedDate });
    if (!parsed.success) return { ok: false, needsClose: true, error: parsed.error.issues[0]!.message };
    patch.salePrice = parsed.data.salePrice;
    patch.deedDate = parsed.data.deedDate;
  }
  if (stage === "a_venda") {
    // Entrar em «À venda» sem data de anúncio: assume hoje.
    const [cur] = await db.select({ listingDate: sales.listingDate }).from(sales).where(eq(sales.id, id));
    if (!cur?.listingDate) patch.listingDate = new Date().toISOString().slice(0, 10);
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(sales).set(patch).where(eq(sales.id, id));
      await tx.update(properties).set({ status: propertyStatusForStage(stage), updatedBy: user.id }).where(eq(properties.id, sale.propertyId));
      if (sale.dealId) {
        const dealStatus = dealStatusForStage(stage);
        await tx
          .update(deals)
          .set({ status: dealStatus, updatedBy: user.id })
          .where(and(eq(deals.id, sale.dealId), dealStatus === "sold" ? eq(deals.status, "active") : eq(deals.status, "sold")));
      }
    });
  } catch (e) {
    return { ok: false, error: dbErrorMessage(e) };
  }
  revalidateSale(id, sale.propertyId, sale.dealId);
  revalidatePath("/deals");
  revalidatePath("/properties");
  return { ok: true };
}

export async function updateSaleNextAction(id: string, input: { nextAction: string; nextActionDate: string }): Promise<Result> {
  const user = await requireUser();
  const parsed = nextActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  await db
    .update(sales)
    .set({ nextAction: parsed.data.nextAction ?? null, nextActionDate: parsed.data.nextActionDate ?? null, updatedBy: user.id })
    .where(and(eq(sales.id, id), eq(sales.organizationId, user.organizationId)));
  revalidateSale(id);
  return { ok: true };
}

export async function completeSaleNextAction(id: string): Promise<void> {
  const user = await requireUser();
  await db
    .update(sales)
    .set({ nextAction: null, nextActionDate: null, updatedBy: user.id })
    .where(and(eq(sales.id, id), eq(sales.organizationId, user.organizationId)));
  revalidateSale(id);
}

export async function deleteSale(id: string): Promise<Result> {
  const user = await requireUser();
  if (user.role === "user") return { ok: false, error: "Sem permissão para apagar vendas." };
  const sale = await ownSale(user.organizationId, id);
  if (!sale) return { ok: false, error: "Venda não encontrada." };
  await db.transaction(async (tx) => {
    await tx.update(sales).set({ deletedAt: new Date(), updatedBy: user.id }).where(eq(sales.id, id));
    await tx.update(properties).set({ status: "owned", updatedBy: user.id }).where(and(eq(properties.id, sale.propertyId), eq(properties.status, "for_sale")));
  });
  revalidateSale(id, sale.propertyId, sale.dealId);
  revalidatePath("/properties");
  redirect("/sales");
}

// ---------- Mediadoras ----------

export async function saveAgency(saleId: string, agencyId: string | null, _prev: AgencyFormState, formData: FormData): Promise<AgencyFormState> {
  const user = await requireUser();
  const values = agencyInputFromForm(formData);
  const parsed = agencySchema.safeParse(values);
  if (!parsed.success) return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues), values };
  const sale = await ownSale(user.organizationId, saleId);
  if (!sale) return { error: "Venda não encontrada." };
  const d = parsed.data;
  try {
    if (agencyId) {
      await db
        .update(saleAgencies)
        .set({ ...d, updatedBy: user.id })
        .where(and(eq(saleAgencies.id, agencyId), eq(saleAgencies.saleId, saleId), eq(saleAgencies.organizationId, user.organizationId)));
    } else {
      await db.insert(saleAgencies).values({ ...d, organizationId: user.organizationId, saleId, propertyId: sale.propertyId, createdBy: user.id, updatedBy: user.id });
    }
  } catch (e) {
    const msg = dbErrorMessage(e);
    return { error: /sale_agencies_sale_contact_idx/.test(String(e)) ? "Essa mediadora já está nesta venda." : msg, values };
  }
  revalidateSale(saleId);
  return {};
}

export async function removeAgency(saleId: string, agencyId: string): Promise<Result> {
  const user = await requireUser();
  await db
    .delete(saleAgencies)
    .where(and(eq(saleAgencies.id, agencyId), eq(saleAgencies.saleId, saleId), eq(saleAgencies.organizationId, user.organizationId)));
  revalidateSale(saleId);
  return { ok: true };
}

// ---------- Leads ----------

export async function saveLead(saleId: string, leadId: string | null, _prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const user = await requireUser();
  const values = leadInputFromForm(formData);
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues), values };
  const sale = await ownSale(user.organizationId, saleId);
  if (!sale) return { error: "Venda não encontrada." };
  const d = parsed.data;
  try {
    if (leadId) {
      await db
        .update(saleLeads)
        .set({ ...d, updatedBy: user.id })
        .where(and(eq(saleLeads.id, leadId), eq(saleLeads.saleId, saleId), eq(saleLeads.organizationId, user.organizationId)));
    } else {
      await db.insert(saleLeads).values({ ...d, organizationId: user.organizationId, saleId, propertyId: sale.propertyId, createdBy: user.id, updatedBy: user.id });
    }
    if (d.status === "ganho") await applyWonLead(saleId, d, user.id);
  } catch (e) {
    return { error: dbErrorMessage(e), values };
  }
  revalidateSale(saleId);
  return {};
}

/** Lead ganho: passa a comprador e, se houver proposta, a preço de venda (quando ainda vazio). */
async function applyWonLead(saleId: string, lead: { contactId?: string | null; offerAmount?: string | null }, userId: string) {
  const [cur] = await db.select({ buyerContactId: sales.buyerContactId, salePrice: sales.salePrice }).from(sales).where(eq(sales.id, saleId));
  if (!cur) return;
  const patch: Partial<typeof sales.$inferInsert> = { updatedBy: userId };
  if (!cur.buyerContactId && lead.contactId) patch.buyerContactId = lead.contactId;
  if (!cur.salePrice && lead.offerAmount) patch.salePrice = lead.offerAmount;
  if (Object.keys(patch).length > 1) await db.update(sales).set(patch).where(eq(sales.id, saleId));
}

export async function setLeadStatus(saleId: string, leadId: string, status: (typeof saleLeads.$inferSelect)["status"]): Promise<Result> {
  const user = await requireUser();
  const [lead] = await db
    .select({ contactId: saleLeads.contactId, offerAmount: saleLeads.offerAmount })
    .from(saleLeads)
    .where(and(eq(saleLeads.id, leadId), eq(saleLeads.saleId, saleId), eq(saleLeads.organizationId, user.organizationId)));
  if (!lead) return { ok: false, error: "Lead não encontrado." };
  await db.update(saleLeads).set({ status, updatedBy: user.id }).where(eq(saleLeads.id, leadId));
  if (status === "ganho") await applyWonLead(saleId, lead, user.id);
  revalidateSale(saleId);
  return { ok: true };
}

export async function updateLeadNextAction(saleId: string, leadId: string, input: { nextAction: string; nextActionDate: string }): Promise<Result> {
  const user = await requireUser();
  const parsed = nextActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  await db
    .update(saleLeads)
    .set({ nextAction: parsed.data.nextAction ?? null, nextActionDate: parsed.data.nextActionDate ?? null, updatedBy: user.id })
    .where(and(eq(saleLeads.id, leadId), eq(saleLeads.saleId, saleId), eq(saleLeads.organizationId, user.organizationId)));
  revalidateSale(saleId);
  return { ok: true };
}

export async function completeLeadNextAction(saleId: string, leadId: string): Promise<void> {
  const user = await requireUser();
  await db
    .update(saleLeads)
    .set({ nextAction: null, nextActionDate: null, updatedBy: user.id })
    .where(and(eq(saleLeads.id, leadId), eq(saleLeads.saleId, saleId), eq(saleLeads.organizationId, user.organizationId)));
  revalidateSale(saleId);
}

export async function removeLead(saleId: string, leadId: string): Promise<Result> {
  const user = await requireUser();
  await db.delete(saleLeads).where(and(eq(saleLeads.id, leadId), eq(saleLeads.saleId, saleId), eq(saleLeads.organizationId, user.organizationId)));
  revalidateSale(saleId);
  return { ok: true };
}
