import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { documents } from "@/modules/documents/schema";
import { properties } from "@/modules/properties/schema";
import { getExecutionBySupplier } from "../measurements/queries";
import { budgetLines, invoices, measurementReports, payments, projectSuppliers, projects, type Invoice, type Payment } from "../schema";

export type InvoiceStatus = "unpaid" | "partial" | "paid" | "overdue";

export type InvoiceRow = Invoice & {
  supplierName: string;
  paidAmount: number;
  status: InvoiceStatus;
  measurementNumber: number | null;
  versionId: string | null;
};

/** Em atraso prevalece sobre parcial: há valor por pagar depois do vencimento. */
export function invoiceStatus(total: number, paid: number, dueDate: string | null, today: string): InvoiceStatus {
  if (paid >= total - 0.005) return "paid";
  if (dueDate && dueDate < today) return "overdue";
  if (paid > 0) return "partial";
  return "unpaid";
}

const paidSub = sql<string>`coalesce((select sum(p.amount) from ${payments} p where p.invoice_id = ${invoices.id}), 0)::text`;

export async function listInvoices(organizationId: string, projectId: string): Promise<InvoiceRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      invoice: invoices,
      supplierName: projectSuppliers.name,
      paid: paidSub,
      measurementNumber: measurementReports.number,
      versionId: documents.currentVersionId,
    })
    .from(invoices)
    .innerJoin(projectSuppliers, eq(invoices.projectSupplierId, projectSuppliers.id))
    .leftJoin(measurementReports, eq(invoices.measurementReportId, measurementReports.id))
    .leftJoin(documents, eq(invoices.documentId, documents.id))
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.projectId, projectId), isNull(invoices.deletedAt)))
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt));
  return rows.map((r) => {
    const paid = Number(r.paid);
    return {
      ...r.invoice,
      supplierName: r.supplierName,
      paidAmount: paid,
      status: invoiceStatus(Number(r.invoice.total), paid, r.invoice.dueDate, today),
      measurementNumber: r.measurementNumber,
      versionId: r.versionId,
    };
  });
}

export async function getInvoice(organizationId: string, id: string): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId), isNull(invoices.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listPayments(invoiceId: string): Promise<Payment[]> {
  return db.select().from(payments).where(eq(payments.invoiceId, invoiceId)).orderBy(asc(payments.paidOn));
}

export type SupplierFinancials = {
  supplierId: string;
  supplierName: string;
  controlMode: "autos" | "fatura";
  budgeted: number;
  executed: number;
  invoicedNet: number;
  paid: number;
  lastMeasurement: { number: number; month: string } | null;
};

export type ProjectFinancials = {
  budgeted: number;
  executed: number;
  invoicedNet: number;
  invoicedGross: number;
  paid: number;
  unpaid: number;
  overdueCount: number;
  bySupplier: SupplierFinancials[];
};

/** Totais da obra e por fornecedor: orçamentado, executado (último auto fechado de cada um), faturado, pago. */
export async function getProjectFinancials(organizationId: string, projectId: string): Promise<ProjectFinancials> {
  const today = new Date().toISOString().slice(0, 10);
  const [suppliers, budgetBySupplier, execution, inv] = await Promise.all([
    db
      .select({ id: projectSuppliers.id, name: projectSuppliers.name, controlMode: projectSuppliers.controlMode })
      .from(projectSuppliers)
      .where(and(eq(projectSuppliers.organizationId, organizationId), eq(projectSuppliers.projectId, projectId)))
      .orderBy(asc(projectSuppliers.sort)),
    db
      .select({ supplierId: budgetLines.projectSupplierId, total: sql<string>`coalesce(sum(${budgetLines.budgeted}), 0)::text` })
      .from(budgetLines)
      .where(and(eq(budgetLines.projectId, projectId), sql`not exists (select 1 from ${budgetLines} c where c.parent_id = ${budgetLines.id})`))
      .groupBy(budgetLines.projectSupplierId),
    getExecutionBySupplier(projectId),
    db
      .select({ supplierId: invoices.projectSupplierId, net: invoices.netAmount, total: invoices.total, dueDate: invoices.dueDate, paid: paidSub })
      .from(invoices)
      .where(and(eq(invoices.organizationId, organizationId), eq(invoices.projectId, projectId), isNull(invoices.deletedAt))),
  ]);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const budgetMap = new Map(budgetBySupplier.map((b) => [b.supplierId, Number(b.total)]));
  const bySupplier: SupplierFinancials[] = suppliers.map((s) => {
    const ex = execution.get(s.id);
    return {
      supplierId: s.id,
      supplierName: s.name,
      controlMode: s.controlMode,
      budgeted: budgetMap.get(s.id) ?? 0,
      executed: ex?.executed ?? 0,
      invoicedNet: 0,
      paid: 0,
      lastMeasurement: ex?.lastNumber && ex.lastMonth ? { number: ex.lastNumber, month: ex.lastMonth } : null,
    };
  });
  const byId = new Map(bySupplier.map((s) => [s.supplierId, s]));

  let invoicedNet = 0;
  let invoicedGross = 0;
  let paid = 0;
  let overdueCount = 0;
  for (const i of inv) {
    const net = Number(i.net);
    const total = Number(i.total);
    const p = Number(i.paid);
    invoicedNet += net;
    invoicedGross += total;
    paid += p;
    if (invoiceStatus(total, p, i.dueDate, today) === "overdue") overdueCount++;
    const s = byId.get(i.supplierId);
    if (s) {
      s.invoicedNet = r2(s.invoicedNet + net);
      s.paid = r2(s.paid + p);
    }
  }
  // Orçamento sem fornecedor (não deveria existir): conta no total, não por fornecedor.
  const budgeted = [...budgetMap.values()].reduce((a, b) => a + b, 0);
  const executed = bySupplier.reduce((a, s) => a + s.executed, 0);
  return {
    budgeted: r2(budgeted),
    executed: r2(executed),
    invoicedNet: r2(invoicedNet),
    invoicedGross: r2(invoicedGross),
    paid: r2(paid),
    unpaid: r2(invoicedGross - paid),
    overdueCount,
    bySupplier,
  };
}

/** Para o dashboard: obras não concluídas com os seus totais. */
export async function listActiveProjectFinancials(organizationId: string) {
  const rows = await db
    .select({ id: projects.id, name: projects.name, status: projects.status, ref: properties.ref })
    .from(projects)
    .innerJoin(properties, eq(projects.propertyId, properties.id))
    .where(and(eq(projects.organizationId, organizationId), isNull(projects.deletedAt), sql`${projects.status} in ('planeamento','a_iniciar','em_curso','pausada')`))
    .orderBy(asc(projects.createdAt));
  return Promise.all(rows.map(async (p) => ({ ...p, fin: await getProjectFinancials(organizationId, p.id) })));
}

/** Faturas por pagar de todas as obras (dashboard), atrasadas primeiro. */
export async function listUnpaidInvoices(organizationId: string, limit = 10) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ invoice: invoices, supplierName: projectSuppliers.name, paid: paidSub, projectId: projects.id, projectName: projects.name })
    .from(invoices)
    .innerJoin(projectSuppliers, eq(invoices.projectSupplierId, projectSuppliers.id))
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .where(and(eq(invoices.organizationId, organizationId), isNull(invoices.deletedAt), sql`${invoices.total} > coalesce((select sum(p.amount) from ${payments} p where p.invoice_id = ${invoices.id}), 0)`))
    .orderBy(sql`${invoices.dueDate} asc nulls last`)
    .limit(limit);
  return rows.map((r) => ({
    id: r.invoice.id,
    number: r.invoice.number,
    supplierName: r.supplierName,
    dueDate: r.invoice.dueDate,
    total: Number(r.invoice.total),
    unpaid: Number(r.invoice.total) - Number(r.paid),
    overdue: invoiceStatus(Number(r.invoice.total), Number(r.paid), r.invoice.dueDate, today) === "overdue",
    projectId: r.projectId,
    projectName: r.projectName,
  }));
}
