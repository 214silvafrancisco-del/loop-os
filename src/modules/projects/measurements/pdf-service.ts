import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createElement, type ReactElement } from "react";
import { db } from "@/core/db/client";
import { organizations } from "@/core/db/schema/core";
import { loadPdfLogo } from "@/core/pdf/brand";
import { documents } from "@/modules/documents/schema";
import { addDocumentVersion, createDocumentWithFile } from "@/modules/documents/service";
import { documentCategories } from "@/modules/settings/schema";
import { getProjectRow } from "../queries";
import { budgetLines, type MeasurementReport } from "../schema";
import { getProjectSupplier } from "../suppliers/queries";
import { calcMeasurement, monthLabel } from "./calc";
import { workInvoiceNet } from "./advance";
import { AutoPdf, type AutoPdfData } from "./pdf/auto-template";
import { getAdvancePctBySupplier, getLastClosedMeasurement, getMeasurementLines, getMeasurementProgress, listBudgetLeaves } from "./queries";

type Actor = { id: string; organizationId: string };

const dateFmt = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso + "T00:00:00"));

/** Junta tudo o que o PDF precisa: organização, obra, fornecedor, artigos por capítulo e totais. */
export async function buildAutoPdfData(organizationId: string, report: MeasurementReport): Promise<AutoPdfData> {
  const [org, project, supplier, leaves, lines, previous, allLines, advanceBySupplier] = await Promise.all([
    db.select({ name: organizations.name, nif: organizations.nif, address: organizations.address }).from(organizations).where(eq(organizations.id, organizationId)).then((r) => r[0]!),
    getProjectRow(organizationId, report.projectId),
    getProjectSupplier(organizationId, report.projectSupplierId),
    listBudgetLeaves(report.projectId, report.projectSupplierId),
    getMeasurementLines(report.id),
    report.kind === "trabalho" ? getLastClosedMeasurement(report.projectId, report.projectSupplierId, report.number) : null,
    db.select({ id: budgetLines.id, parentId: budgetLines.parentId, description: budgetLines.description, code: budgetLines.code }).from(budgetLines).where(eq(budgetLines.projectId, report.projectId)),
    getAdvancePctBySupplier(report.projectId),
  ]);
  if (!project) throw new Error("Obra não encontrada.");
  if (!supplier) throw new Error("Fornecedor não encontrado.");

  const previousProgress = await getMeasurementProgress(previous?.id ?? null);
  const saved = new Map(lines.map((l) => [l.budgetLineId, Number(l.pctCumulative)]));
  const byId = new Map(allLines.map((l) => [l.id, l]));
  const chapterOf = (leafId: string) => {
    let cur = byId.get(leafId);
    while (cur?.parentId) cur = byId.get(cur.parentId);
    return cur ? `${cur.code ?? ""} ${cur.description}`.trim() : "—";
  };
  const leafInputs = leaves.map((l) => ({ budgetLineId: l.id, budgeted: Number(l.budgeted), previousPct: previousProgress.get(l.id)?.pct ?? 0, previousAmount: previousProgress.get(l.id)?.amount ?? 0 }));
  const calc = calcMeasurement(
    leafInputs,
    leaves.map((l) => ({ budgetLineId: l.id, pctCumulative: saved.get(l.id) ?? previousProgress.get(l.id)?.pct ?? 0 })),
  );
  const byLine = new Map(calc.lines.map((l) => [l.budgetLineId, l]));

  const chapters: AutoPdfData["chapters"] = [];
  for (const l of leaves) {
    const title = chapterOf(l.id);
    let ch = chapters.find((c) => c.title === title);
    if (!ch) {
      ch = { title, budget: 0, cumulative: 0, period: 0, lines: [] };
      chapters.push(ch);
    }
    const c = byLine.get(l.id);
    const input = leafInputs.find((x) => x.budgetLineId === l.id)!;
    const line = { code: l.code, description: l.description, budget: Number(l.budgeted), previousPct: input.previousPct, pct: saved.get(l.id) ?? input.previousPct, cumulative: c?.amountCumulative ?? 0, period: c?.amountPeriod ?? 0 };
    ch.lines.push(line);
    ch.budget += line.budget;
    ch.cumulative += line.cumulative;
    ch.period += line.period;
  }

  const advancePct = advanceBySupplier.get(report.projectSupplierId) ?? 0;
  const today = new Date();
  const generatedAt = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(today);
  // Fechado: os totais são os snapshots guardados no fecho; rascunho: o cálculo atual.
  const totals = report.status === "closed" && report.kind === "trabalho"
    ? { budget: calc.totalBudget, cumulative: Number(report.totalCumulative), period: Number(report.totalPeriod), progress: calc.totalBudget ? Number(report.totalCumulative) / calc.totalBudget : 0 }
    : { budget: calc.totalBudget, cumulative: calc.totalCumulative, period: calc.totalPeriod, progress: calc.progress };

  return {
    kind: report.kind,
    number: report.number,
    status: report.status,
    periodLabel: monthLabel(report.periodMonth),
    reportDate: fmtDate(report.reportDate),
    generatedAt,
    notes: report.notes,
    company: { name: org.name, nif: org.nif, address: org.address },
    project: { name: project.name, ref: project.ref, address: [project.addressLine, project.parish, project.municipality].filter(Boolean).join(", ") },
    supplier: { name: supplier.name, nif: supplier.nif, email: supplier.email, phone: supplier.phone },
    totals,
    advance: report.kind === "trabalho" && advancePct > 0 ? { pct: advancePct, netToInvoice: workInvoiceNet(totals.period, advancePct) } : null,
    advanceAuto: report.kind === "adiantamento" ? { amount: Number(report.totalPeriod), pct: Number(report.advancePct ?? 0) } : null,
    chapters,
  };
}

/** Documento já gerado para este auto (entity_type measurement_report), se existir. */
async function findAutoDocument(organizationId: string, reportId: string) {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.organizationId, organizationId), eq(documents.entityType, "measurement_report"), eq(documents.entityId, reportId), isNull(documents.deletedAt)))
    .orderBy(desc(documents.createdAt))
    .limit(1);
  return doc ?? null;
}

/**
 * Gera o PDF do auto e arquiva-o nos Documentos da obra (Técnico → Auto de
 * medição), ligado ao auto. Repetir a exportação cria uma nova versão do mesmo
 * documento; as anteriores ficam no histórico. Devolve a versão para abrir/partilhar.
 */
export async function exportAutoPdf(user: Actor, report: MeasurementReport): Promise<{ documentId: string; versionId: string; fileName: string }> {
  const data = await buildAutoPdfData(user.organizationId, report);
  const logoSrc = await loadPdfLogo();
  const element = createElement(AutoPdf, { data, logoSrc }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(element);
  const bytes = new Uint8Array(pdf);

  const kindLabel = report.kind === "trabalho" ? "Auto" : "Auto de adiantamento";
  const draft = report.status === "draft" ? " (rascunho)" : "";
  const fileName = `${kindLabel} ${report.number} - ${data.project.ref} - ${data.supplier.name}${draft}.pdf`;
  const existing = await findAutoDocument(user.organizationId, report.id);
  if (existing) {
    const { versionId } = await addDocumentVersion(user, existing.id, { fileName, mimeType: "application/pdf", bytes }, `Exportado em ${data.generatedAt}${draft}`);
    return { documentId: existing.id, versionId, fileName };
  }
  const project = await getProjectRow(user.organizationId, report.projectId);
  const [category] = await db
    .select({ id: documentCategories.id })
    .from(documentCategories)
    .where(and(eq(documentCategories.organizationId, user.organizationId), eq(documentCategories.group, "tecnico"), eq(documentCategories.name, "Auto de medição")))
    .limit(1);
  const { documentId, versionId } = await createDocumentWithFile(
    user,
    {
      propertyId: project!.propertyId,
      entityType: "measurement_report",
      entityId: report.id,
      categoryId: category?.id ?? null,
      name: `${kindLabel} n.º ${report.number} · ${data.supplier.name}`,
      description: report.kind === "trabalho" ? `Período ${data.periodLabel}` : `Adiantamento ${Math.round((data.advanceAuto?.pct ?? 0) * 100)} %`,
      docDate: report.reportDate,
    },
    { fileName, mimeType: "application/pdf", bytes },
  );
  return { documentId, versionId, fileName };
}
