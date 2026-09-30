"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { dbErrorMessage } from "@/core/db/errors";
import { invoices, payments, projectSuppliers, projects } from "../schema";
import { getInvoice } from "./queries";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const money = z.number().min(0).max(1e9);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

const invoiceSchema = z.object({
  projectSupplierId: z.uuid("Escolhe o fornecedor da obra."),
  number: z.string().trim().min(1, "Indica o número da fatura.").max(60),
  issueDate: isoDate,
  dueDate: isoDate.nullable(),
  description: z.string().trim().max(500).nullable(),
  netAmount: money,
  vatRate: z.number().min(0).max(1),
  vatAmount: money,
  total: money,
  measurementReportId: z.uuid().nullable(),
  notes: z.string().trim().max(2000).nullable(),
});
export type InvoiceInput = z.input<typeof invoiceSchema>;

const paymentSchema = z.object({
  paidOn: isoDate,
  amount: z.number().positive("Indica o valor pago."),
  method: z.enum(["transferencia", "mb", "cartao", "numerario", "outro"]),
  reference: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(500).nullable(),
});
export type PaymentInput = z.input<typeof paymentSchema>;

async function ownProject(organizationId: string, projectId: string) {
  const [p] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
  return p ?? null;
}

async function supplierBelongs(projectSupplierId: string, projectId: string) {
  const [s] = await db.select({ id: projectSuppliers.id }).from(projectSuppliers).where(and(eq(projectSuppliers.id, projectSupplierId), eq(projectSuppliers.projectId, projectId)));
  return Boolean(s);
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

function moneyCols(d: z.output<typeof invoiceSchema>) {
  if (Math.abs(d.netAmount + d.vatAmount - d.total) > 0.05) return null;
  return {
    netAmount: d.netAmount.toFixed(2),
    vatRate: d.vatRate.toFixed(4),
    vatAmount: d.vatAmount.toFixed(2),
    total: d.total.toFixed(2),
  };
}

export async function createInvoice(projectId: string, raw: unknown): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = invoiceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!(await ownProject(user.organizationId, projectId))) return { ok: false, error: "Obra não encontrada." };
  const cols = moneyCols(parsed.data);
  if (!cols) return { ok: false, error: "Líquido + IVA tem de ser igual ao total." };
  const d = parsed.data;
  if (!(await supplierBelongs(d.projectSupplierId, projectId))) return { ok: false, error: "Fornecedor inválido para esta obra." };
  try {
    const [created] = await db
      .insert(invoices)
      .values({
        organizationId: user.organizationId,
        projectId,
        projectSupplierId: d.projectSupplierId,
        number: d.number,
        issueDate: d.issueDate,
        dueDate: d.dueDate,
        description: d.description,
        ...cols,
        measurementReportId: d.measurementReportId,
        notes: d.notes,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: invoices.id });
    revalidate(projectId);
    return { ok: true, id: created!.id };
  } catch (e) {
    if (dbErrorMessage(e).includes("invoices_supplier_number_idx")) return { ok: false, error: "Já existe uma fatura deste fornecedor com este número." };
    throw e;
  }
}

export async function updateInvoice(invoiceId: string, raw: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = invoiceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const existing = await getInvoice(user.organizationId, invoiceId);
  if (!existing) return { ok: false, error: "Fatura não encontrada." };
  const cols = moneyCols(parsed.data);
  if (!cols) return { ok: false, error: "Líquido + IVA tem de ser igual ao total." };
  const d = parsed.data;
  if (!(await supplierBelongs(d.projectSupplierId, existing.projectId))) return { ok: false, error: "Fornecedor inválido para esta obra." };
  try {
    await db
      .update(invoices)
      .set({
        projectSupplierId: d.projectSupplierId,
        number: d.number,
        issueDate: d.issueDate,
        dueDate: d.dueDate,
        description: d.description,
        ...cols,
        measurementReportId: d.measurementReportId,
        notes: d.notes,
        updatedBy: user.id,
      })
      .where(eq(invoices.id, invoiceId));
  } catch (e) {
    if (dbErrorMessage(e).includes("invoices_supplier_number_idx")) return { ok: false, error: "Já existe uma fatura deste fornecedor com este número." };
    throw e;
  }
  revalidate(existing.projectId);
  return { ok: true };
}

/** Liga o PDF carregado (via /api/documents/upload com entityType=invoice) à fatura. */
export async function attachInvoiceDocument(invoiceId: string, documentId: string): Promise<Result> {
  const user = await requireUser();
  const existing = await getInvoice(user.organizationId, invoiceId);
  if (!existing) return { ok: false, error: "Fatura não encontrada." };
  await db.update(invoices).set({ documentId, updatedBy: user.id }).where(eq(invoices.id, invoiceId));
  revalidate(existing.projectId);
  return { ok: true };
}

export async function deleteInvoice(invoiceId: string): Promise<Result> {
  const user = await requireUser();
  if (user.role === "user") return { ok: false, error: "Sem permissão para eliminar faturas." };
  const existing = await getInvoice(user.organizationId, invoiceId);
  if (!existing) return { ok: false, error: "Fatura não encontrada." };
  await db.update(invoices).set({ deletedAt: new Date(), updatedBy: user.id }).where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)));
  revalidate(existing.projectId);
  return { ok: true };
}

export async function addPayment(invoiceId: string, raw: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const existing = await getInvoice(user.organizationId, invoiceId);
  if (!existing) return { ok: false, error: "Fatura não encontrada." };
  try {
    await db.insert(payments).values({
      invoiceId,
      paidOn: parsed.data.paidOn,
      amount: parsed.data.amount.toFixed(2),
      method: parsed.data.method,
      reference: parsed.data.reference,
      notes: parsed.data.notes,
      createdBy: user.id,
      updatedBy: user.id,
    });
  } catch (e) {
    if (dbErrorMessage(e).includes("excedem o total")) return { ok: false, error: "Esse pagamento excede o valor por pagar da fatura." };
    throw e;
  }
  revalidate(existing.projectId);
  return { ok: true };
}

export async function deletePayment(paymentId: string): Promise<Result> {
  const user = await requireUser();
  const [row] = await db
    .select({ projectId: invoices.projectId })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(payments.id, paymentId), eq(invoices.organizationId, user.organizationId)));
  if (!row) return { ok: false, error: "Pagamento não encontrado." };
  await db.delete(payments).where(eq(payments.id, paymentId));
  revalidate(row.projectId);
  return { ok: true };
}
