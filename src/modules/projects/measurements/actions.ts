"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { measurementLines, measurementReports, projects } from "../schema";
import { calcMeasurement, firstOfMonth, nextMonth, type LeafForMeasurement } from "./calc";
import { getLastClosedMeasurement, getMeasurement, getMeasurementProgress, listBudgetLeaves } from "./queries";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function ownProject(organizationId: string, projectId: string) {
  const [p] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
  return p ?? null;
}

/** Folhas do orçamento com o progresso do último auto fechado antes de `beforeNumber`. */
async function leavesWithPrevious(projectId: string, beforeNumber?: number): Promise<LeafForMeasurement[]> {
  const [leaves, previous] = await Promise.all([listBudgetLeaves(projectId), getLastClosedMeasurement(projectId, beforeNumber)]);
  const progress = await getMeasurementProgress(previous?.id ?? null);
  return leaves.map((l) => ({
    budgetLineId: l.id,
    budgeted: Number(l.budgeted),
    previousPct: progress.get(l.id)?.pct ?? 0,
    previousAmount: progress.get(l.id)?.amount ?? 0,
  }));
}

/** Novo auto em rascunho: número seguinte, mês seguinte ao último, % pré-preenchidas. */
export async function createMeasurement(projectId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const project = await ownProject(user.organizationId, projectId);
  if (!project) return { ok: false, error: "Obra não encontrada." };

  const [last] = await db
    .select({ number: measurementReports.number, periodMonth: measurementReports.periodMonth, status: measurementReports.status })
    .from(measurementReports)
    .where(eq(measurementReports.projectId, projectId))
    .orderBy(desc(measurementReports.number))
    .limit(1);
  if (last && last.status === "draft") return { ok: false, error: `O auto n.º ${last.number} ainda está em rascunho. Fecha-o primeiro.` };

  const leaves = await leavesWithPrevious(projectId);
  if (leaves.length === 0) return { ok: false, error: "O orçamento ainda não tem artigos." };

  const today = new Date().toISOString().slice(0, 10);
  const periodMonth = last ? nextMonth(last.periodMonth) : firstOfMonth(today);
  const calc = calcMeasurement(leaves, []);

  const id = await db.transaction(async (tx) => {
    const [report] = await tx
      .insert(measurementReports)
      .values({
        organizationId: user.organizationId,
        projectId,
        number: (last?.number ?? 0) + 1,
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

  const leaves = await leavesWithPrevious(report.projectId, report.number);
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
