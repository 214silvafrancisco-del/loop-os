import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { budgetLines, measurementLines, measurementReports, projectSuppliers, type MeasurementReport } from "../schema";
import { advancePctFrom } from "./advance";

export type MeasurementRow = MeasurementReport & {
  authorName: string | null;
  supplierName: string;
  /** Líquido das faturas ligadas a este auto (null se ainda não há fatura). */
  invoicedNet: number | null;
  invoiceCount: number;
};

/** Autos da obra (trabalho e adiantamento), com o fornecedor e a fatura ligada. */
export async function listMeasurements(organizationId: string, projectId: string): Promise<MeasurementRow[]> {
  const rows = await db
    .select({
      report: measurementReports,
      authorName: profiles.fullName,
      supplierName: projectSuppliers.name,
      invoicedNet: sql<string | null>`(select sum(i.net_amount)::text from invoices i where i.measurement_report_id = measurement_reports.id and i.deleted_at is null)`,
      invoiceCount: sql<number>`(select count(*)::int from invoices i where i.measurement_report_id = measurement_reports.id and i.deleted_at is null)`,
    })
    .from(measurementReports)
    .innerJoin(projectSuppliers, eq(measurementReports.projectSupplierId, projectSuppliers.id))
    .leftJoin(profiles, eq(measurementReports.createdBy, profiles.id))
    .where(and(eq(measurementReports.organizationId, organizationId), eq(measurementReports.projectId, projectId)))
    .orderBy(desc(measurementReports.number));
  return rows.map((r) => ({ ...r.report, authorName: r.authorName, supplierName: r.supplierName, invoicedNet: r.invoicedNet === null ? null : Number(r.invoicedNet), invoiceCount: r.invoiceCount }));
}

/** % de adiantamento em vigor por fornecedor (último auto de adiantamento fechado; 0 se não houver). */
export async function getAdvancePctBySupplier(projectId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ supplierId: measurementReports.projectSupplierId, kind: measurementReports.kind, status: measurementReports.status, number: measurementReports.number, advancePct: measurementReports.advancePct })
    .from(measurementReports)
    .where(eq(measurementReports.projectId, projectId));
  const map = new Map<string, number>();
  for (const supplierId of new Set(rows.map((r) => r.supplierId))) {
    map.set(supplierId, advancePctFrom(rows.filter((r) => r.supplierId === supplierId).map((r) => ({ ...r, advancePct: r.advancePct === null ? null : Number(r.advancePct) }))));
  }
  return map;
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

/** Último auto de trabalho fechado de um fornecedor da obra (antes de `beforeNumber`, se dado). */
export async function getLastClosedMeasurement(projectId: string, projectSupplierId: string, beforeNumber?: number): Promise<MeasurementReport | null> {
  const conditions = [eq(measurementReports.projectId, projectId), eq(measurementReports.projectSupplierId, projectSupplierId), eq(measurementReports.status, "closed"), eq(measurementReports.kind, "trabalho")];
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

/** Artigos (folhas) do orçamento de um fornecedor, por ordem da árvore. */
export async function listBudgetLeaves(projectId: string, projectSupplierId: string) {
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
    .where(
      and(
        eq(budgetLines.projectId, projectId),
        eq(budgetLines.projectSupplierId, projectSupplierId),
        sql`not exists (select 1 from ${budgetLines} c where c.parent_id = ${budgetLines.id})`,
      ),
    )
    .orderBy(asc(budgetLines.code));
}

export type SupplierExecution = { executed: number; lastNumber: number | null; lastMonth: string | null; draftCount: number };

/** Executado por fornecedor = acumulado do último auto de trabalho fechado de cada um (adiantamentos não contam). */
export async function getExecutionBySupplier(projectId: string): Promise<Map<string, SupplierExecution>> {
  const rows = await db
    .select({ supplierId: measurementReports.projectSupplierId, number: measurementReports.number, month: measurementReports.periodMonth, total: measurementReports.totalCumulative, status: measurementReports.status })
    .from(measurementReports)
    .where(and(eq(measurementReports.projectId, projectId), eq(measurementReports.kind, "trabalho")))
    .orderBy(desc(measurementReports.number));
  const map = new Map<string, SupplierExecution>();
  for (const r of rows) {
    const cur = map.get(r.supplierId) ?? { executed: 0, lastNumber: null, lastMonth: null, draftCount: 0 };
    if (r.status === "draft") cur.draftCount++;
    else if (cur.lastNumber === null) {
      cur.executed = Number(r.total);
      cur.lastNumber = r.number;
      cur.lastMonth = r.month;
    }
    map.set(r.supplierId, cur);
  }
  return map;
}

/** Executado da obra = soma dos últimos autos fechados de cada fornecedor. */
export async function getExecutedTotal(organizationId: string, projectId: string): Promise<{ executed: number; lastNumber: number | null; lastMonth: string | null }> {
  const bySupplier = await getExecutionBySupplier(projectId);
  let executed = 0;
  let lastNumber: number | null = null;
  let lastMonth: string | null = null;
  for (const s of bySupplier.values()) {
    executed += s.executed;
    if (s.lastNumber !== null && (lastNumber === null || s.lastNumber > lastNumber)) {
      lastNumber = s.lastNumber;
      lastMonth = s.lastMonth;
    }
  }
  void organizationId;
  return { executed: Math.round(executed * 100) / 100, lastNumber, lastMonth };
}
