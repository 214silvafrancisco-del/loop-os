import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { todayIso } from "@/core/lib/dates";
import { calcScenario } from "@/modules/business-plan/calc";
import { scenarioRowToInputs } from "@/modules/business-plan/mapper";
import { getActiveScenarioForDeal, getImtContext } from "@/modules/business-plan/queries";
import { getDealContext, propertyContextOf } from "@/modules/business-plan/service";
import { deals } from "@/modules/deals/schema";
import { invoices, projects } from "@/modules/projects/schema";
import { commissionAmount } from "./constants";
import { buildPnl, type RealInputs } from "./pnl";
import { listSaleAgencies } from "./queries";
import { sales, type Sale } from "./schema";

export type SalePnl = ReturnType<typeof buildPnl> & {
  scenarioName: string | null;
  notes: string[];
};

/** P&L de uma venda: cenário ativo do negócio de origem vs custos e receita reais. */
export async function getSalePnl(organizationId: string, sale: Sale): Promise<SalePnl> {
  const notes: string[] = [];
  const today = todayIso();

  const [deal] = sale.dealId
    ? await db
        .select({ finalPrice: deals.finalPrice, actualAcquisitionCosts: deals.actualAcquisitionCosts, deedDate: deals.deedDate, askingPrice: deals.askingPrice })
        .from(deals)
        .where(and(eq(deals.id, sale.dealId), eq(deals.organizationId, organizationId)))
    : [];
  if (!deal) notes.push("Sem negócio de origem: aquisição a zero.");
  else if (!deal.finalPrice) notes.push("O negócio não tem valor final de compra registado.");

  // Business Plan: cenário ativo recalculado com as tabelas de IMT.
  let bp = null;
  let scenarioName: string | null = null;
  let taxRate = 0;
  if (sale.dealId) {
    const [scenario, ctx] = await Promise.all([getActiveScenarioForDeal(organizationId, sale.dealId), getDealContext(organizationId, sale.dealId)]);
    if (scenario && ctx) {
      const inputs = scenarioRowToInputs(scenario, propertyContextOf(ctx));
      const { ctx: imt } = await getImtContext(organizationId);
      bp = calcScenario(inputs, imt);
      scenarioName = scenario.name;
      // Como no motor do BP: empresa paga IRC sobre o lucro; particular paga IRS sobre 50 % da mais-valia.
      taxRate = scenario.taxRegime === "empresa" ? Number(scenario.ircPct) : 0.5 * Number(scenario.irsPct);
    } else notes.push("Sem cenário ativo no Business Plan: só o real.");
  }
  if (!taxRate) {
    taxRate = 0.19;
    notes.push("Imposto estimado a 19 % (IRC) por falta de cenário.");
  }

  // Obra: faturas com IVA de todas as obras do imóvel.
  const projectIds = (
    await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.propertyId, sale.propertyId), eq(projects.organizationId, organizationId), isNull(projects.deletedAt)))
  ).map((p) => p.id);
  const [works] = projectIds.length
    ? await db
        .select({ total: sql<string>`coalesce(sum(${invoices.total}), 0)::text` })
        .from(invoices)
        .where(and(inArray(invoices.projectId, projectIds), isNull(invoices.deletedAt)))
    : [{ total: "0" }];
  if (projectIds.length === 0) notes.push("Sem obra ligada ao imóvel: obra real a zero.");

  const agencies = await listSaleAgencies(organizationId, sale.id);
  const price = sale.salePrice ?? sale.listingPrice;
  const agencyCommissions = agencies.reduce(
    (a, ag) => a + commissionAmount(price ? Number(price) : null, { commissionPct: ag.commissionPct ? Number(ag.commissionPct) : null, commissionFixed: ag.commissionFixed ? Number(ag.commissionFixed) : null, commissionVatPct: Number(ag.commissionVatPct) }).total,
    0,
  );
  if (sale.actualHoldingCosts === null) notes.push("Custos de detenção reais por preencher (Resumo).");
  if (sale.actualFinancingCosts === null && bp && bp.financing > 0) notes.push("Custos de financiamento reais por preencher (Resumo).");

  const real: RealInputs = {
    purchasePrice: deal?.finalPrice ? Number(deal.finalPrice) : null,
    acquisitionCosts: deal?.actualAcquisitionCosts ? Number(deal.actualAcquisitionCosts) : null,
    worksInvoiced: Number(works!.total),
    holdingCosts: sale.actualHoldingCosts ? Number(sale.actualHoldingCosts) : null,
    financingCosts: sale.actualFinancingCosts ? Number(sale.actualFinancingCosts) : null,
    agencyCommissions,
    otherSaleCosts: Number(sale.otherSaleCosts ?? 0),
    salePrice: sale.stage === "vendido" && sale.salePrice ? Number(sale.salePrice) : null,
    listingPrice: sale.salePrice ? Number(sale.salePrice) : sale.listingPrice ? Number(sale.listingPrice) : null,
    taxRate,
    purchaseDate: deal?.deedDate ?? null,
    saleDate: sale.stage === "vendido" ? sale.deedDate : null,
    today,
  };
  return { ...buildPnl(bp, real), scenarioName, notes };
}

/** Vendas fechadas num ano com o lucro líquido real (para o dashboard). */
export async function listSoldSummary(organizationId: string, year: number): Promise<{ count: number; revenue: number; netProfit: number }> {
  const rows = await db
    .select()
    .from(sales)
    .where(and(eq(sales.organizationId, organizationId), isNull(sales.deletedAt), eq(sales.stage, "vendido"), sql`extract(year from ${sales.deedDate}) = ${year}`));
  let revenue = 0;
  let netProfit = 0;
  for (const s of rows) {
    const p = await getSalePnl(organizationId, s);
    revenue += p.real.revenue;
    netProfit += p.real.netProfit;
  }
  return { count: rows.length, revenue, netProfit };
}
