import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { imtBrackets } from "@/modules/settings/schema";
import type { CalcContext } from "./calc";
import { bpComparables, businessPlans, bpScenarios, type BpComparable, type BpScenario, type BusinessPlan } from "./schema";

export async function listComparables(organizationId: string, businessPlanId: string): Promise<BpComparable[]> {
  return db
    .select()
    .from(bpComparables)
    .where(and(eq(bpComparables.organizationId, organizationId), eq(bpComparables.businessPlanId, businessPlanId)))
    .orderBy(asc(bpComparables.sort), asc(bpComparables.createdAt));
}

export async function getBusinessPlanByDeal(organizationId: string, dealId: string): Promise<BusinessPlan | null> {
  const [row] = await db
    .select()
    .from(businessPlans)
    .where(and(eq(businessPlans.organizationId, organizationId), eq(businessPlans.dealId, dealId)))
    .limit(1);
  return row ?? null;
}

/** Cenário ativo do negócio (para sugestões de preço na proposta). */
export async function getActiveScenarioForDeal(organizationId: string, dealId: string): Promise<BpScenario | null> {
  const [row] = await db
    .select({ scenario: bpScenarios })
    .from(bpScenarios)
    .innerJoin(businessPlans, eq(bpScenarios.businessPlanId, businessPlans.id))
    .where(and(eq(businessPlans.organizationId, organizationId), eq(businessPlans.dealId, dealId), eq(bpScenarios.isActive, true)))
    .limit(1);
  return row?.scenario ?? null;
}

export async function listScenarios(organizationId: string, businessPlanId: string): Promise<BpScenario[]> {
  return db
    .select()
    .from(bpScenarios)
    .where(and(eq(bpScenarios.organizationId, organizationId), eq(bpScenarios.businessPlanId, businessPlanId)))
    .orderBy(asc(bpScenarios.sort), asc(bpScenarios.createdAt));
}

export async function getScenario(organizationId: string, scenarioId: string): Promise<BpScenario | null> {
  const [row] = await db
    .select()
    .from(bpScenarios)
    .where(and(eq(bpScenarios.organizationId, organizationId), eq(bpScenarios.id, scenarioId)))
    .limit(1);
  return row ?? null;
}

/**
 * Tabelas de IMT do ano mais recente disponível (≤ ano pedido) como
 * contexto do motor de cálculo.
 */
export async function getImtContext(organizationId: string, year = new Date().getFullYear()): Promise<{ ctx: CalcContext; year: number | null }> {
  const rows = await db
    .select()
    .from(imtBrackets)
    .where(eq(imtBrackets.organizationId, organizationId))
    .orderBy(desc(imtBrackets.year), asc(imtBrackets.lower));
  const years = [...new Set(rows.map((r) => r.year))].filter((y) => y <= year);
  const chosen = years.length ? Math.max(...years) : rows[0]?.year ?? null;
  const pick = (regime: "hpp" | "hs") =>
    rows
      .filter((r) => r.year === chosen && r.regime === regime)
      .map((r) => ({
        lower: Number(r.lower),
        upper: r.upper === null ? null : Number(r.upper),
        rate: Number(r.rate),
        deduction: Number(r.deduction),
      }));
  return { ctx: { imtBrackets: { hpp: pick("hpp"), hs: pick("hs") } }, year: chosen };
}
