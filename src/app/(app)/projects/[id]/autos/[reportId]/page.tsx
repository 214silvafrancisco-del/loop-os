import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { Button } from "@/components/ui/button";
import { db } from "@/core/db/client";
import { eq } from "drizzle-orm";
import { MeasurementEditor, type MeasurementLeafView } from "@/modules/projects/components/measurement-editor";
import { getLastClosedMeasurement, getMeasurement, getMeasurementLines, getMeasurementProgress, listBudgetLeaves } from "@/modules/projects/measurements/queries";
import { budgetLines } from "@/modules/projects/schema";

export default async function MeasurementPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const user = await requireUser();
  const { id, reportId } = await params;
  const report = await getMeasurement(user.organizationId, reportId);
  if (!report || report.projectId !== id) notFound();

  const [leaves, lines, previous, allLines] = await Promise.all([
    listBudgetLeaves(id),
    getMeasurementLines(reportId),
    getLastClosedMeasurement(id, report.number),
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
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href={`/projects/${id}/autos`}><ArrowLeft className="size-4" /> Autos</Link>
        </Button>
        <h2 className="text-base font-semibold">Auto de medição n.º {report.number}</h2>
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
