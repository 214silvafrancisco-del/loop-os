"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { CALC_VERSION, calcScenario } from "./calc";
import { outputsToColumns, scenarioRowToInputs } from "./mapper";
import { getImtContext, getScenario } from "./queries";
import { bpComparables, businessPlans, bpScenarios } from "./schema";
import { getDealContext, propertyContextOf, writeDealCache } from "./service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const signedPct = z.number().min(-1).max(1);
const comparableSchema = z.object({
  id: z.uuid().nullable(),
  label: z.string().trim().max(120).nullable(),
  sourceUrl: z.string().trim().max(2000).nullable(),
  price: z.number().min(0).max(1e9),
  area: z.number().min(0).max(1e5),
  floor: z.string().trim().max(20).nullable(),
  hasElevator: z.boolean().nullable(),
  condition: z.enum(["para_obras", "habitavel", "remodelado", "novo"]).nullable(),
  adjNegotiation: signedPct,
  adjArea: signedPct,
  adjLocation: signedPct,
  adjAge: signedPct,
  adjCondition: signedPct,
  adjOther: signedPct,
  notes: z.string().trim().max(2000).nullable(),
  isIncluded: z.boolean(),
});
export type ComparableDraft = z.infer<typeof comparableSchema>;

const referencesSchema = z.object({
  referenceM2Idealista: z.number().min(0).nullable(),
  referenceM2Maxwork: z.number().min(0).nullable(),
  referenceM2Consultant: z.number().min(0).nullable(),
  valuationM2: z.number().min(0).nullable(),
});

async function planLink(organizationId: string, businessPlanId: string) {
  const [row] = await db
    .select({ id: businessPlans.id, dealId: businessPlans.dealId })
    .from(businessPlans)
    .where(and(eq(businessPlans.id, businessPlanId), eq(businessPlans.organizationId, organizationId)));
  return row ?? null;
}

const pct4 = (v: number) => v.toFixed(4);

/**
 * Guarda a lista completa de comparáveis: atualiza os existentes, cria os
 * novos (id null) e apaga os que deixaram de estar na lista.
 */
export async function saveComparables(businessPlanId: string, rawRows: unknown, rawRefs: unknown): Promise<Result> {
  const user = await requireUser();
  const rows = z.array(comparableSchema).max(20).safeParse(rawRows);
  if (!rows.success) return { ok: false, error: rows.error.issues[0]?.message ?? "Dados inválidos." };
  const refs = referencesSchema.safeParse(rawRefs);
  if (!refs.success) return { ok: false, error: "Referências inválidas." };
  const link = await planLink(user.organizationId, businessPlanId);
  if (!link) return { ok: false, error: "Business Plan não encontrado." };

  await db.transaction(async (tx) => {
    const keepIds: string[] = [];
    for (const [index, r] of rows.data.entries()) {
      const values = {
        sort: index + 1,
        label: r.label,
        sourceUrl: r.sourceUrl,
        price: r.price.toFixed(2),
        area: r.area.toFixed(2),
        floor: r.floor,
        hasElevator: r.hasElevator,
        condition: r.condition,
        adjNegotiation: pct4(r.adjNegotiation),
        adjArea: pct4(r.adjArea),
        adjLocation: pct4(r.adjLocation),
        adjAge: pct4(r.adjAge),
        adjCondition: pct4(r.adjCondition),
        adjOther: pct4(r.adjOther),
        notes: r.notes,
        isIncluded: r.isIncluded,
        updatedBy: user.id,
      };
      if (r.id) {
        await tx
          .update(bpComparables)
          .set(values)
          .where(and(eq(bpComparables.id, r.id), eq(bpComparables.businessPlanId, businessPlanId)));
        keepIds.push(r.id);
      } else {
        const [created] = await tx
          .insert(bpComparables)
          .values({ ...values, organizationId: user.organizationId, businessPlanId, createdBy: user.id })
          .returning({ id: bpComparables.id });
        keepIds.push(created!.id);
      }
    }
    if (keepIds.length) {
      await tx.delete(bpComparables).where(and(eq(bpComparables.businessPlanId, businessPlanId), notInArray(bpComparables.id, keepIds)));
    } else {
      await tx.delete(bpComparables).where(eq(bpComparables.businessPlanId, businessPlanId));
    }
    const money = (v: number | null) => (v === null ? null : v.toFixed(2));
    await tx
      .update(businessPlans)
      .set({
        referenceM2Idealista: money(refs.data.referenceM2Idealista),
        referenceM2Maxwork: money(refs.data.referenceM2Maxwork),
        referenceM2Consultant: money(refs.data.referenceM2Consultant),
        valuationM2: money(refs.data.valuationM2),
        updatedBy: user.id,
      })
      .where(eq(businessPlans.id, businessPlanId));
  });

  revalidatePath(`/deals/${link.dealId}/analise`);
  revalidatePath(`/deals/${link.dealId}`, "layout");
  return { ok: true };
}

/** Leva o valor de venda da avaliação para um cenário do Business Plan e recalcula. */
export async function applyValuationToScenario(scenarioId: string, salePrice: number): Promise<Result> {
  const user = await requireUser();
  if (!Number.isFinite(salePrice) || salePrice <= 0) return { ok: false, error: "Valor inválido." };
  const scenario = await getScenario(user.organizationId, scenarioId);
  if (!scenario) return { ok: false, error: "Cenário não encontrado." };
  const [plan] = await db.select({ dealId: businessPlans.dealId }).from(businessPlans).where(eq(businessPlans.id, scenario.businessPlanId));
  if (!plan) return { ok: false, error: "Business Plan não encontrado." };
  const dealCtx = await getDealContext(user.organizationId, plan.dealId);
  if (!dealCtx) return { ok: false, error: "Negócio não encontrado." };

  const updated = { ...scenario, salePrice: salePrice.toFixed(2) };
  const { ctx } = await getImtContext(user.organizationId);
  const outputs = calcScenario(scenarioRowToInputs(updated, propertyContextOf(dealCtx)), ctx);
  await db
    .update(bpScenarios)
    .set({ salePrice: updated.salePrice, ...outputsToColumns(outputs, CALC_VERSION), updatedBy: user.id })
    .where(inArray(bpScenarios.id, [scenarioId]));
  if (scenario.isActive) await writeDealCache(plan.dealId, scenarioId, outputs, user.id);

  revalidatePath(`/deals/${plan.dealId}/business-plan`);
  revalidatePath(`/deals/${plan.dealId}/analise`);
  revalidatePath(`/deals/${plan.dealId}`, "layout");
  revalidatePath("/deals");
  return { ok: true };
}
