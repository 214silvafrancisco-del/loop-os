"use client";

import { FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/core/lib/format";
import { deleteAdvanceMeasurement } from "../measurements/actions";

type Props = {
  projectId: string;
  report: { id: string; number: number; reportDate: string; amount: number; advancePct: number; notes: string | null; status: "draft" | "closed" };
  document: { versionId: string; name: string } | null;
  invoice: { id: string; number: string } | null;
};

/** Auto de adiantamento: só leitura (corresponde à fatura de adiantamento). */
export function AdvanceAutoCard({ projectId, report, document, invoice }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Apagar o auto de adiantamento n.º ${report.number}?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteAdvanceMeasurement(report.id);
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-warning/50 bg-warning/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide">Auto de adiantamento</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Valor do adiantamento" value={formatMoney(report.amount)} strong />
        <Stat label="Percentagem de adiantamento" value={`${Math.round(report.advancePct * 10000) / 100} %`} hint="descontada na fatura de cada auto de trabalho seguinte" strong />
        <Stat label="Data" value={formatDate(report.reportDate)} />
      </div>
      <div className="rounded-xl border bg-card p-4 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Fatura de adiantamento</dt>
            <dd>
              {invoice ? (
                <Link href={`/projects/${projectId}/faturas`} className="hover:underline">
                  {invoice.number}
                </Link>
              ) : (
                <span className="text-muted-foreground">ainda não registada · regista-a em Faturas e liga-a a este auto</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Documento do auto</dt>
            <dd>
              {document ? (
                <a href={`/api/documents/${document.versionId}/download?inline=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  <FileText className="size-4" /> {document.name}
                </a>
              ) : (
                <span className="text-muted-foreground">sem documento</span>
              )}
            </dd>
          </div>
          {report.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Observações</dt>
              <dd className="whitespace-pre-wrap">{report.notes}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      {!invoice ? (
        <div className="flex items-center justify-end gap-2">
          {error ? <span className="mr-auto text-xs text-destructive">{error}</span> : null}
          <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={remove} disabled={pending}>
            <Trash2 className="size-4" /> Apagar adiantamento
          </Button>
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={strong ? "text-lg font-semibold tabular-nums" : "text-lg tabular-nums"}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
