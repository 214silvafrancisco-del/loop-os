import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { budgetLines, measurementLines, measurementReports, type MeasurementReport } from "../schema";

export type MeasurementRow = MeasurementReport & { authorName: string | null };

export async function listMeasurements(organizationId: string, projectId: string): Promise<MeasurementRow[]> {
  const rows = await db
    .select({ report: measurementReports, authorName: profiles.fullName })
    .from(measurementReports)
    .leftJoin(profiles, eq(measurementReports.createdBy, profiles.id))
    .where(and(eq(measurementReports.organizationId, organizationId), eq(measurementReports.projectId, projectId)))
    .orderBy(desc(measurementReports.number));
  return rows.map((r) => ({ ...r.report, authorName: r.authorName }));
}

export async function getMeasurement(organizationId: string, reportId: string): Promise<MeasurementReport | null> {
  const [row] = await db
    .select()
    .from(measurementReports)
    .where(and(eq(measurementReports.id, reportId), eq(measurementReports.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function getMeasurementLines(reportId: string) {
  return db.select().from(measurementLines).where(eq(measurementLines.reportId, reportId));
}

/** Último auto fechado da obra, ou null. */
export async function getLastClosedMeasurement(projectId: string, beforeNumber?: number): Promise<MeasurementReport | null> {
  const conditions = [eq(measurementReports.projectId, projectId), eq(measurementReports.status, "closed")];
  if (beforeNumber !== undefined) conditions.push(sql`${measurementReports.number} < ${beforeNumber}`);
  const [row] = await db
    .select()
    .from(measurementReports)
    .where(and(...conditions))
    .orderBy(desc(measurementReports.number))
    .limit(1);
  return row ?? null;
}

/** % e € acumulados por artigo no auto indicado (mapa vazio se null). */
export async function getMeasurementProgress(reportId: string | null): Promise<Map<string, { pct: number; amount: number }>> {
  const map = new Map<string, { pct: number; amount: number }>();
  if (!reportId) return map;
  const rows = await db
    .select({ budgetLineId: measurementLines.budgetLineId, pct: measurementLines.pctCumulative, amount: measurementLines.amountCumulative })
    .from(measurementLines)
    .where(eq(measurementLines.reportId, reportId));
  for (const r of rows) map.set(r.budgetLineId, { pct: Number(r.pct), amount: Number(r.amount) });
  return map;
}

/** Artigos (folhas) do orçamento, por ordem da árvore. */
export async function listBudgetLeaves(projectId: string) {
  return db
    .select({
      id: budgetLines.id,
      parentId: budgetLines.parentId,
      code: budgetLines.code,
      description: budgetLines.description,
      budgeted: budgetLines.budgeted,
      depth: budgetLines.depth,
      sort: budgetLines.sort,
    })
    .from(budgetLines)
    .where(and(eq(budgetLines.projectId, projectId), sql`not exists (select 1 from ${budgetLines} c where c.parent_id = ${budgetLines.id})`))
    .orderBy(asc(budgetLines.code));
}

/** Executado da obra = acumulado do último auto fechado. */
export async function getExecutedTotal(organizationId: string, projectId: string): Promise<{ executed: number; lastNumber: number | null; lastMonth: string | null }> {
  const [row] = await db
    .select({ total: measurementReports.totalCumulative, number: measurementReports.number, month: measurementReports.periodMonth })
    .from(measurementReports)
    .where(and(eq(measurementReports.organizationId, organizationId), eq(measurementReports.projectId, projectId), eq(measurementReports.status, "closed")))
    .orderBy(desc(measurementReports.number))
    .limit(1);
  return { executed: Number(row?.total ?? 0), lastNumber: row?.number ?? null, lastMonth: row?.month ?? null };
}
