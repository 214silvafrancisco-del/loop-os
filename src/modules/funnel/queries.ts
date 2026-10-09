import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { auditLog } from "@/core/db/schema/audit";
import { deals } from "@/modules/deals/schema";
import { proposals } from "@/modules/proposals/schema";
import { dealStages } from "@/modules/settings/schema";
import { forecastPurchases, type Forecast, type FunnelWeek } from "./forecast";
import { funnelWeeks, type FunnelWeekRow } from "./schema";
import { addDaysIso, isCompleteWeek, recentWeekStarts } from "./weeks";

export type SuggestedCounts = { leads: number; visits: number; proposals: number; purchases: number };

/**
 * Valores sugeridos pela app para uma semana: negócios entrados, passagens a
 * «Visita» e a «Compra» (auditoria das mudanças de fase; compra também por
 * escritura na semana) e propostas geradas. O utilizador pode corrigir.
 */
export async function getSuggestedCounts(organizationId: string, weekStart: string): Promise<SuggestedCounts> {
  const end = addDaysIso(weekStart, 7);
  const since = new Date(weekStart + "T00:00:00");
  const until = new Date(end + "T00:00:00");
  const stages = await db.select({ id: dealStages.id, name: dealStages.name, isPurchase: dealStages.isPurchase }).from(dealStages).where(eq(dealStages.organizationId, organizationId));
  const purchaseIds = stages.filter((s) => s.isPurchase).map((s) => s.id);
  const visitIds = stages.filter((s) => /visita/i.test(s.name)).map((s) => s.id);

  const movedTo = (ids: string[]) =>
    ids.length
      ? db
          .select({ n: sql<number>`count(distinct ${auditLog.rowId})::int` })
          .from(auditLog)
          .where(
            and(
              eq(auditLog.organizationId, organizationId),
              eq(auditLog.tableName, "deals"),
              gte(auditLog.at, since),
              lt(auditLog.at, until),
              sql`'stage_id' = any(${auditLog.changedFields})`,
              inArray(sql`${auditLog.newData} ->> 'stage_id'`, ids),
            ),
          )
      : Promise.resolve([{ n: 0 }]);

  const [[leads], [props], [visits], [moved], [deeded]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(deals)
      .where(and(eq(deals.organizationId, organizationId), isNull(deals.deletedAt), gte(deals.enteredAt, weekStart), lt(deals.enteredAt, end))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(proposals)
      .where(and(eq(proposals.organizationId, organizationId), gte(proposals.createdAt, since), lt(proposals.createdAt, until))),
    movedTo(visitIds),
    movedTo(purchaseIds),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(deals)
      .where(and(eq(deals.organizationId, organizationId), isNull(deals.deletedAt), gte(deals.deedDate, weekStart), lt(deals.deedDate, end))),
  ]);
  return { leads: leads?.n ?? 0, visits: visits?.n ?? 0, proposals: props?.n ?? 0, purchases: Math.max(moved?.n ?? 0, deeded?.n ?? 0) };
}

export type FunnelTableRow = FunnelWeek & { id: string | null; suggested: SuggestedCounts; isCurrent: boolean; isComplete: boolean; notes: string | null };

/** As `n` semanas mais recentes (atual incluída) com registo e sugestão. */
export async function listRecentFunnelWeeks(organizationId: string, today: string, n = 5): Promise<FunnelTableRow[]> {
  const starts = recentWeekStarts(today, n);
  const [rows, suggestions] = await Promise.all([
    db
      .select()
      .from(funnelWeeks)
      .where(and(eq(funnelWeeks.organizationId, organizationId), gte(funnelWeeks.weekStart, starts[starts.length - 1]!))),
    Promise.all(starts.map((s) => getSuggestedCounts(organizationId, s))),
  ]);
  const byWeek = new Map(rows.map((r) => [r.weekStart, r]));
  return starts.map((weekStart, i) => toTableRow(weekStart, byWeek.get(weekStart) ?? null, suggestions[i]!, today));
}

function toTableRow(weekStart: string, row: FunnelWeekRow | null, suggested: SuggestedCounts, today: string): FunnelTableRow {
  return {
    id: row?.id ?? null,
    weekStart,
    leads: row?.leads ?? null,
    visits: row?.visits ?? null,
    proposals: row?.proposals ?? null,
    purchases: row?.purchases ?? null,
    notes: row?.notes ?? null,
    suggested,
    isCurrent: i0(weekStart, today),
    isComplete: isCompleteWeek(weekStart, today),
  };
}
const i0 = (weekStart: string, today: string) => recentWeekStarts(today, 1)[0] === weekStart;

/** Histórico completo (todas as semanas registadas + as 5 recentes), da mais recente para a mais antiga. */
export async function listAllFunnelWeeks(organizationId: string, today: string): Promise<FunnelTableRow[]> {
  const rows = await db.select().from(funnelWeeks).where(eq(funnelWeeks.organizationId, organizationId)).orderBy(desc(funnelWeeks.weekStart));
  const starts = new Set<string>([...recentWeekStarts(today, 5), ...rows.map((r) => r.weekStart)]);
  const ordered = [...starts].sort((a, b) => (a < b ? 1 : -1));
  const byWeek = new Map(rows.map((r) => [r.weekStart, r]));
  const suggestions = await Promise.all(ordered.map((s) => getSuggestedCounts(organizationId, s)));
  return ordered.map((s, i) => toTableRow(s, byWeek.get(s) ?? null, suggestions[i]!, today));
}

/** Previsão a partir das semanas completas registadas (a atual fica de fora). */
export async function getFunnelForecast(organizationId: string, today: string): Promise<Forecast> {
  const rows = await db.select().from(funnelWeeks).where(eq(funnelWeeks.organizationId, organizationId));
  const complete = rows.filter((r) => isCompleteWeek(r.weekStart, today)).map((r) => ({ weekStart: r.weekStart, leads: r.leads, visits: r.visits, proposals: r.proposals, purchases: r.purchases }));
  return forecastPurchases(complete);
}
