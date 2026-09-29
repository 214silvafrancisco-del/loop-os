import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { contacts } from "@/modules/contacts/schema";
import { documents } from "@/modules/documents/schema";
import { properties } from "@/modules/properties/schema";
import { budgetLines, invoices, measurementReports, payments, projects, type Invoice, type Payment } from "../schema";

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
      supplierName: contacts.name,
      paid: paidSub,
      measurementNumber: measurementReports.number,
      versionId: documents.currentVersionId,
    })
    .from(invoices)
    .innerJoin(contacts, eq(invoices.supplierId, contacts.id))
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

export type ProjectFinancials = {
  budgeted: number;
  executed: number;
  invoicedNet: number;
  invoicedGross: number;
  paid: number;
  unpaid: number;
  overdueCount: number;
  bySupplier: { supplierId: string; supplierName: string; budgeted: number; invoicedNet: number; paid: number }[];
};

/** Totais da obra: orçamentado, executado, faturado, pago; e por fornecedor. */
export async function getProjectFinancials(organizationId: string, projectId: string): Promise<ProjectFinancials> {
  const today = new Date().toISOString().slice(0, 10);
  const [budget] = await db
    .select({ total: sql<string>`coalesce(sum(${budgetLines.budgeted}), 0)::text` })
    .from(budgetLines)
    .where(and(eq(budgetLines.projectId, projectId), sql`not exists (select 1 from ${budgetLines} c where c.parent_id = ${budgetLines.id})`));
  const [executed] = await db
    .select({ total: measurementReports.totalCumulative })
    .from(measurementReports)
    .where(and(eq(measurementReports.projectId, projectId), eq(measurementReports.status, "closed")))
    .orderBy(desc(measurementReports.number))
    .limit(1);
  const inv = await db
    .select({ supplierId: invoices.supplierId, supplierName: contacts.name, net: invoices.netAmount, total: invoices.total, dueDate: invoices.dueDate, paid: paidSub })
    .from(invoices)
    .innerJoin(contacts, eq(invoices.supplierId, contacts.id))
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.projectId, projectId), isNull(invoices.deletedAt)));
  const budgetBySupplier = await db
    .select({ supplierId: budgetLines.supplierId, supplierName: contacts.name, total: sql<string>`coalesce(sum(${budgetLines.budgeted}), 0)::text` })
    .from(budgetLines)
    .innerJoin(contacts, eq(budgetLines.supplierId, contacts.id))
    .where(and(eq(budgetLines.projectId, projectId), sql`not exists (select 1 from ${budgetLines} c where c.parent_id = ${budgetLines.id})`))
    .groupBy(budgetLines.supplierId, contacts.name);

  const bySupplier = new Map<string, ProjectFinancials["bySupplier"][number]>();
  for (const b of budgetBySupplier) {
    bySupplier.set(b.supplierId!, { supplierId: b.supplierId!, supplierName: b.supplierName, budgeted: Number(b.total), invoicedNet: 0, paid: 0 });
  }
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
    const s = bySupplier.get(i.supplierId) ?? { supplierId: i.supplierId, supplierName: i.supplierName, budgeted: 0, invoicedNet: 0, paid: 0 };
    s.invoicedNet += net;
    s.paid += p;
    bySupplier.set(i.supplierId, s);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    budgeted: Number(budget?.total ?? 0),
    executed: Number(executed?.total ?? 0),
    invoicedNet: r2(invoicedNet),
    invoicedGross: r2(invoicedGross),
    paid: r2(paid),
    unpaid: r2(invoicedGross - paid),
    overdueCount,
    bySupplier: [...bySupplier.values()].sort((a, b) => b.budgeted + b.invoicedNet - (a.budgeted + a.invoicedNet)),
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
    .select({ invoice: invoices, supplierName: contacts.name, paid: paidSub, projectId: projects.id, projectName: projects.name })
    .from(invoices)
    .innerJoin(contacts, eq(invoices.supplierId, contacts.id))
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
