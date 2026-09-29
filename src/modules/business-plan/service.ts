import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { deals } from "@/modules/deals/schema";
import { properties } from "@/modules/properties/schema";
import { CALC_VERSION, calcScenario, type CalcContext, type ScenarioOutputs } from "./calc";
import {
  defaultScenarioInputs,
  inputsToScenarioColumns,
  outputsToColumns,
  scenarioRowToInputs,
  type PropertyContext,
} from "./mapper";
import { getBusinessPlanByDeal, getImtContext, listScenarios } from "./queries";
import { businessPlans, bpScenarios, type BpScenario, type BusinessPlan } from "./schema";

type User = { id: string; organizationId: string };

/** Dados do imóvel e do negócio que alimentam o cenário. */
export async function getDealContext(organizationId: string, dealId: string) {
  const [row] = await db
    .select({
      dealId: deals.id,
      propertyId: deals.propertyId,
      askingPrice: deals.askingPrice,
      targetPrice: deals.targetPrice,
      estimatedWorks: deals.estimatedWorks,
      estimatedSalePrice: deals.estimatedSalePrice,
      activeScenarioId: deals.activeScenarioId,
      grossArea: properties.grossArea,
      isAru: properties.isAru,
      vpt: properties.vpt,
    })
    .from(deals)
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export function propertyContextOf(ctx: { grossArea: string | null; isAru: boolean }): PropertyContext {
  return { grossArea: Number(ctx.grossArea ?? 0), isAru: ctx.isAru };
}

/** Escreve a cache do cenário ativo no negócio (lista, Kanban, dashboard). */
export async function writeDealCache(dealId: string, scenarioId: string, o: ScenarioOutputs, userId: string) {
  await db
    .update(deals)
    .set({
      activeScenarioId: scenarioId,
      bpProfitNet: o.netProfit.toFixed(2),
      bpMargin: o.margin.toFixed(6),
      bpRoi: o.roi.toFixed(6),
      bpRoe: o.roe.toFixed(6),
      bpAnnualized: o.annualized.toFixed(6),
      bpEquity: o.equity.toFixed(2),
      updatedBy: userId,
    })
    .where(eq(deals.id, dealId));
}

/** Recalcula um cenário, grava o snapshot e, se for o ativo, a cache do negócio. */
export async function recomputeScenario(user: User, scenario: BpScenario, property: PropertyContext, ctx: CalcContext, dealId: string): Promise<ScenarioOutputs> {
  const outputs = calcScenario(scenarioRowToInputs(scenario, property), ctx);
  await db
    .update(bpScenarios)
    .set({ ...outputsToColumns(outputs, CALC_VERSION), updatedBy: user.id })
    .where(eq(bpScenarios.id, scenario.id));
  if (scenario.isActive) await writeDealCache(dealId, scenario.id, outputs, user.id);
  return outputs;
}

/**
 * Devolve o Business Plan do negócio, criando-o com os cenários "Ato Contínuo"
 * e "Remodelação" na primeira vez. Remodelação fica ativo.
 */
export async function ensureBusinessPlan(user: User, dealId: string): Promise<{ plan: BusinessPlan; scenarios: BpScenario[] }> {
  const existing = await getBusinessPlanByDeal(user.organizationId, dealId);
  if (existing) {
    return { plan: existing, scenarios: await listScenarios(user.organizationId, existing.id) };
  }

  const dealCtx = await getDealContext(user.organizationId, dealId);
  if (!dealCtx) throw new Error("Negócio não encontrado.");
  const property = propertyContextOf(dealCtx);
  const { ctx } = await getImtContext(user.organizationId);

  const seed = {
    purchasePrice: Number(dealCtx.targetPrice ?? dealCtx.askingPrice ?? 0),
    salePrice: Number(dealCtx.estimatedSalePrice ?? 0),
    vpt: Number(dealCtx.vpt ?? 0),
    worksBudget: Number(dealCtx.estimatedWorks ?? 0),
    isAru: dealCtx.isAru,
    grossArea: property.grossArea,
  };

  const created = await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(businessPlans)
      .values({ organizationId: user.organizationId, dealId, createdBy: user.id, updatedBy: user.id })
      .returning();

    const kinds = [
      { kind: "ato_continuo" as const, name: "Ato Contínuo", sort: 1, isActive: false },
      { kind: "remodelacao" as const, name: "Remodelação", sort: 2, isActive: true },
    ];
    const scenarios: BpScenario[] = [];
    for (const k of kinds) {
      const inputs = defaultScenarioInputs(k.kind, seed);
      const outputs = calcScenario(inputs, ctx);
      const [s] = await tx
        .insert(bpScenarios)
        .values({
          organizationId: user.organizationId,
          businessPlanId: plan!.id,
          name: k.name,
          kind: k.kind,
          sort: k.sort,
          isActive: k.isActive,
          ...inputsToScenarioColumns(inputs),
          ...outputsToColumns(outputs, CALC_VERSION),
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      scenarios.push(s!);
      if (k.isActive) {
        await tx
          .update(deals)
          .set({
            activeScenarioId: s!.id,
            bpProfitNet: outputs.netProfit.toFixed(2),
            bpMargin: outputs.margin.toFixed(6),
            bpRoi: outputs.roi.toFixed(6),
            bpRoe: outputs.roe.toFixed(6),
            bpAnnualized: outputs.annualized.toFixed(6),
            bpEquity: outputs.equity.toFixed(2),
            updatedBy: user.id,
          })
          .where(eq(deals.id, dealId));
      }
    }
    return { plan: plan!, scenarios };
  });
  return created;
}
