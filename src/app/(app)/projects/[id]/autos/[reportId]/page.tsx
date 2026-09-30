import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { Button } from "@/components/ui/button";
import { db } from "@/core/db/client";
import { eq } from "drizzle-orm";
import { AdvanceAutoCard } from "@/modules/projects/components/advance-auto-card";
import { MeasurementEditor, type MeasurementLeafView } from "@/modules/projects/components/measurement-editor";
import { getLastClosedMeasurement, getMeasurement, getMeasurementLines, getMeasurementProgress, listBudgetLeaves } from "@/modules/projects/measurements/queries";
import { documents } from "@/modules/documents/schema";
import { budgetLines, invoices } from "@/modules/projects/schema";
import { getProjectSupplier } from "@/modules/projects/suppliers/queries";

export default async function MeasurementPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const user = await requireUser();
  const { id, reportId } = await params;
  const report = await getMeasurement(user.organizationId, reportId);
  if (!report || report.projectId !== id) notFound();

  if (report.kind === "adiantamento") {
    const [supplierRow, [doc], [inv]] = await Promise.all([
      getProjectSupplier(user.organizationId, report.projectSupplierId),
      db.select({ versionId: documents.currentVersionId, name: documents.name }).from(documents).where(eq(documents.id, report.documentId ?? "00000000-0000-0000-0000-000000000000")),
      db.select({ id: invoices.id, number: invoices.number }).from(invoices).where(eq(invoices.measurementReportId, report.id)).limit(1),
    ]);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href={`/projects/${id}/autos`}><ArrowLeft className="size-4" /> Autos</Link>
          </Button>
          <h2 className="text-base font-semibold">Auto de adiantamento n.º {report.number}</h2>
          {supplierRow ? <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{supplierRow.name}</span> : null}
        </div>
        <AdvanceAutoCard
          report={{ id: report.id, number: report.number, reportDate: report.reportDate, amount: Number(report.totalPeriod), advancePct: Number(report.advancePct ?? 0), notes: report.notes, status: report.status }}
          document={doc?.versionId ? { versionId: doc.versionId, name: doc.name } : null}
          invoice={inv ? { id: inv.id, number: inv.number } : null}
          projectId={id}
        />
      </div>
    );
  }

  const [supplier, leaves, lines, previous, allLines] = await Promise.all([
    getProjectSupplier(user.organizationId, report.projectSupplierId),
    listBudgetLeaves(id, report.projectSupplierId),
    getMeasurementLines(reportId),
    getLastClosedMeasurement(id, report.projectSupplierId, report.number),
    db.select({ id: budgetLines.id, parentId: budgetLines.parentId, description: budgetLines.description, code: budgetLines.code }).from(budgetLines).where(eq(budgetLines.projectId, id)),
  ]);
  const previousProgress = await getMeasurementProgress(previous?.id ?? null);
  const saved = new Map(lines.map((l) => [l.budgetLineId, Number(l.pctCumulative)]));

  // Capítulo (raiz) de cada folha, para agrupar.
  const byId = new Map(allLines.map((l) => [l.id, l]));
  const chapterOf = (leafId: string) => {
    let cur = byId.get(leafId);
    while (cur?.parentId) cur = byId.get(cur.parentId);
    return cur ? `${cur.code ?? ""} ${cur.description}`.trim() : "—";
  };

  const view: MeasurementLeafView[] = leaves.map((l) => ({
    budgetLineId: l.id,
    code: l.code,
    description: l.description,
    chapter: chapterOf(l.id),
    budgeted: Number(l.budgeted),
    previousPct: previousProgress.get(l.id)?.pct ?? 0,
    previousAmount: previousProgress.get(l.id)?.amount ?? 0,
    pct: saved.get(l.id) ?? previousProgress.get(l.id)?.pct ?? 0,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href={`/projects/${id}/autos`}><ArrowLeft className="size-4" /> Autos</Link>
        </Button>
        <h2 className="text-base font-semibold">Auto de trabalho n.º {report.number}</h2>
        {supplier ? <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{supplier.name}</span> : null}
      </div>
      <MeasurementEditor
        key={report.updatedAt.toISOString()}
        reportId={report.id}
        number={report.number}
        periodMonth={report.periodMonth}
        reportDate={report.reportDate}
        notes={report.notes}
        status={report.status}
        leaves={view}
        previousNumber={previous?.number ?? null}
      />
    </div>
  );
}
