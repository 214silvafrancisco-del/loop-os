"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { invoices, measurementLines, measurementReports, projectSuppliers, projects } from "../schema";
import { calcMeasurement, firstOfMonth, nextMonth, type LeafForMeasurement } from "./calc";
import { getLastClosedMeasurement, getMeasurement, getMeasurementProgress, listBudgetLeaves } from "./queries";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function ownProject(organizationId: string, projectId: string) {
  const [p] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
  return p ?? null;
}

/** Folhas do orçamento do fornecedor com o progresso do seu último auto fechado antes de `beforeNumber`. */
async function leavesWithPrevious(projectId: string, projectSupplierId: string, beforeNumber?: number): Promise<LeafForMeasurement[]> {
  const [leaves, previous] = await Promise.all([listBudgetLeaves(projectId, projectSupplierId), getLastClosedMeasurement(projectId, projectSupplierId, beforeNumber)]);
  const progress = await getMeasurementProgress(previous?.id ?? null);
  return leaves.map((l) => ({
    budgetLineId: l.id,
    budgeted: Number(l.budgeted),
    previousPct: progress.get(l.id)?.pct ?? 0,
    previousAmount: progress.get(l.id)?.amount ?? 0,
  }));
}

/**
 * Novo auto em rascunho para um fornecedor: número seguinte da obra, mês
 * seguinte ao último auto desse fornecedor, % pré-preenchidas com o anterior.
 */
export async function createMeasurement(projectId: string, projectSupplierId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const project = await ownProject(user.organizationId, projectId);
  if (!project) return { ok: false, error: "Obra não encontrada." };
  const [supplier] = await db
    .select({ id: projectSuppliers.id, name: projectSuppliers.name, controlMode: projectSuppliers.controlMode })
    .from(projectSuppliers)
    .where(and(eq(projectSuppliers.id, projectSupplierId), eq(projectSuppliers.projectId, projectId)));
  if (!supplier) return { ok: false, error: "Fornecedor não encontrado nesta obra." };
  if (supplier.controlMode !== "autos") return { ok: false, error: `${supplier.name} é controlado por fatura, não por autos.` };

  const [lastOfSupplier] = await db
    .select({ number: measurementReports.number, periodMonth: measurementReports.periodMonth, status: measurementReports.status })
    .from(measurementReports)
    .where(and(eq(measurementReports.projectId, projectId), eq(measurementReports.projectSupplierId, projectSupplierId), eq(measurementReports.kind, "trabalho")))
    .orderBy(desc(measurementReports.number))
    .limit(1);
  if (lastOfSupplier && lastOfSupplier.status === "draft") return { ok: false, error: `O auto n.º ${lastOfSupplier.number} de ${supplier.name} ainda está em rascunho. Fecha-o primeiro.` };
  const [lastOfProject] = await db
    .select({ number: measurementReports.number })
    .from(measurementReports)
    .where(eq(measurementReports.projectId, projectId))
    .orderBy(desc(measurementReports.number))
    .limit(1);

  const leaves = await leavesWithPrevious(projectId, projectSupplierId);
  if (leaves.length === 0) return { ok: false, error: `O orçamento de ${supplier.name} ainda não tem artigos.` };

  const today = new Date().toISOString().slice(0, 10);
  const periodMonth = lastOfSupplier ? nextMonth(lastOfSupplier.periodMonth) : firstOfMonth(today);
  const calc = calcMeasurement(leaves, []);

  const id = await db.transaction(async (tx) => {
    const [report] = await tx
      .insert(measurementReports)
      .values({
        organizationId: user.organizationId,
        projectId,
        projectSupplierId,
        number: (lastOfProject?.number ?? 0) + 1,
        periodMonth,
        reportDate: today,
        status: "draft",
        totalPeriod: calc.totalPeriod.toFixed(2),
        totalCumulative: calc.totalCumulative.toFixed(2),
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: measurementReports.id });
    if (calc.lines.length) {
      await tx.insert(measurementLines).values(
        calc.lines.map((l) => ({
          reportId: report!.id,
          budgetLineId: l.budgetLineId,
          pctCumulative: l.pctCumulative.toFixed(4),
          amountCumulative: l.amountCumulative.toFixed(2),
          amountPeriod: l.amountPeriod.toFixed(2),
          updatedBy: user.id,
        })),
      );
    }
    return report!.id;
  });
  revalidatePath(`/projects/${projectId}`, "layout");
  redirect(`/projects/${projectId}/autos/${id}`);
}

const linesSchema = z.array(z.object({ budgetLineId: z.uuid(), pctCumulative: z.number().min(0).max(1) })).max(2000);
const metaSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(2000).nullable(),
});

/** Guarda as % de um auto em rascunho e recalcula os valores. */
export async function saveMeasurement(reportId: string, rawLines: unknown, rawMeta: unknown, close: boolean): Promise<Result> {
  const user = await requireUser();
  const report = await getMeasurement(user.organizationId, reportId);
  if (!report) return { ok: false, error: "Auto não encontrado." };
  if (report.status === "closed") return { ok: false, error: "Este auto está fechado. Cria o auto seguinte para corrigir." };
  const lines = linesSchema.safeParse(rawLines);
  const meta = metaSchema.safeParse(rawMeta);
  if (!lines.success || !meta.success) return { ok: false, error: "Dados inválidos." };

  const leaves = await leavesWithPrevious(report.projectId, report.projectSupplierId, report.number);
  const calc = calcMeasurement(leaves, lines.data);

  await db.transaction(async (tx) => {
    await tx.delete(measurementLines).where(eq(measurementLines.reportId, reportId));
    if (calc.lines.length) {
      await tx.insert(measurementLines).values(
        calc.lines.map((l) => ({
          reportId,
          budgetLineId: l.budgetLineId,
          pctCumulative: l.pctCumulative.toFixed(4),
          amountCumulative: l.amountCumulative.toFixed(2),
          amountPeriod: l.amountPeriod.toFixed(2),
          updatedBy: user.id,
        })),
      );
    }
    await tx
      .update(measurementReports)
      .set({
        reportDate: meta.data.reportDate,
        notes: meta.data.notes,
        totalPeriod: calc.totalPeriod.toFixed(2),
        totalCumulative: calc.totalCumulative.toFixed(2),
        status: close ? "closed" : "draft",
        closedAt: close ? new Date() : null,
        updatedBy: user.id,
      })
      .where(eq(measurementReports.id, reportId));
  });

  revalidatePath(`/projects/${report.projectId}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Apaga um auto em rascunho. */
export async function deleteDraftMeasurement(reportId: string): Promise<Result> {
  const user = await requireUser();
  const report = await getMeasurement(user.organizationId, reportId);
  if (!report) return { ok: false, error: "Auto não encontrado." };
  if (report.status === "closed") return { ok: false, error: "Autos fechados não se apagam." };
  await db.delete(measurementReports).where(eq(measurementReports.id, reportId));
  revalidatePath(`/projects/${report.projectId}`, "layout");
  redirect(`/projects/${report.projectId}/autos`);
}

const advanceSchema = z.object({
  projectSupplierId: z.uuid("Escolhe o fornecedor."),
  number: z.number().int().min(0).nullable(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  amount: z.number().positive("Indica o valor do adiantamento."),
  /** Percentagem 0–100 como o utilizador escreve. */
  advancePct: z.number().min(0).max(100),
  notes: z.string().trim().max(2000).nullable(),
});
export type AdvanceInput = z.input<typeof advanceSchema>;

/**
 * Auto de adiantamento: corresponde à fatura de adiantamento, não a trabalho
 * executado. Nasce em rascunho (para se poder anexar o documento) e fecha-se
 * com `finalizeAdvanceMeasurement`. Guarda a % que os autos de trabalho
 * seguintes descontam na fatura.
 */
export async function createAdvanceMeasurement(projectId: string, raw: unknown): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = advanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const project = await ownProject(user.organizationId, projectId);
  if (!project) return { ok: false, error: "Obra não encontrada." };
  const d = parsed.data;
  const [supplier] = await db
    .select({ id: projectSuppliers.id })
    .from(projectSuppliers)
    .where(and(eq(projectSuppliers.id, d.projectSupplierId), eq(projectSuppliers.projectId, projectId)));
  if (!supplier) return { ok: false, error: "Fornecedor não encontrado nesta obra." };

  let number = d.number;
  if (number === null) {
    const [last] = await db.select({ number: measurementReports.number }).from(measurementReports).where(eq(measurementReports.projectId, projectId)).orderBy(desc(measurementReports.number)).limit(1);
    number = (last?.number ?? -1) + 1;
  } else {
    const [dup] = await db.select({ id: measurementReports.id }).from(measurementReports).where(and(eq(measurementReports.projectId, projectId), eq(measurementReports.number, number)));
    if (dup) return { ok: false, error: `Já existe um auto n.º ${number} nesta obra.` };
  }

  const [created] = await db
    .insert(measurementReports)
    .values({
      organizationId: user.organizationId,
      projectId,
      projectSupplierId: d.projectSupplierId,
      number,
      kind: "adiantamento",
      advancePct: (d.advancePct / 100).toFixed(4),
      periodMonth: firstOfMonth(d.reportDate),
      reportDate: d.reportDate,
      status: "draft",
      notes: d.notes,
      totalPeriod: d.amount.toFixed(2),
      totalCumulative: "0",
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: measurementReports.id });
  return { ok: true, id: created!.id };
}

/** Fecha o auto de adiantamento, com o documento (opcional) anexado. */
export async function finalizeAdvanceMeasurement(reportId: string, documentId: string | null): Promise<Result> {
  const user = await requireUser();
  const report = await getMeasurement(user.organizationId, reportId);
  if (!report || report.kind !== "adiantamento") return { ok: false, error: "Auto de adiantamento não encontrado." };
  if (report.status === "closed") return { ok: true };
  await db
    .update(measurementReports)
    .set({ documentId: documentId ?? report.documentId, status: "closed", closedAt: new Date(), updatedBy: user.id })
    .where(eq(measurementReports.id, reportId));
  revalidatePath(`/projects/${report.projectId}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Apaga um auto de adiantamento sem faturas ligadas. */
export async function deleteAdvanceMeasurement(reportId: string): Promise<Result> {
  const user = await requireUser();
  const report = await getMeasurement(user.organizationId, reportId);
  if (!report || report.kind !== "adiantamento") return { ok: false, error: "Auto de adiantamento não encontrado." };
  const [inv] = await db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.measurementReportId, reportId), isNull(invoices.deletedAt))).limit(1);
  if (inv) return { ok: false, error: "Este adiantamento já tem fatura ligada. Elimina primeiro a fatura." };
  await db.delete(measurementReports).where(eq(measurementReports.id, reportId));
  revalidatePath(`/projects/${report.projectId}`, "layout");
  redirect(`/projects/${report.projectId}/autos`);
}
