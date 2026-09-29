"use client";

import { Check, Lock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/core/lib/format";
import { deleteDraftMeasurement, saveMeasurement } from "../measurements/actions";
import { calcMeasurement, monthLabel, type LeafForMeasurement } from "../measurements/calc";

export type MeasurementLeafView = LeafForMeasurement & {
  code: string | null;
  description: string;
  chapter: string;
  /** % guardada neste auto. */
  pct: number;
};

type Props = {
  reportId: string;
  number: number;
  periodMonth: string;
  reportDate: string;
  notes: string | null;
  status: "draft" | "closed";
  leaves: MeasurementLeafView[];
  previousNumber: number | null;
};

export function MeasurementEditor({ reportId, number, periodMonth, reportDate, notes: initialNotes, status, leaves, previousNumber }: Props) {
  const router = useRouter();
  const closed = status === "closed";
  const [pcts, setPcts] = useState<Record<string, number>>(Object.fromEntries(leaves.map((l) => [l.budgetLineId, l.pct])));
  const [date, setDate] = useState(reportDate);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const inputs = useMemo(() => Object.entries(pcts).map(([budgetLineId, pctCumulative]) => ({ budgetLineId, pctCumulative })), [pcts]);
  const calc = useMemo(() => calcMeasurement(leaves, inputs), [leaves, inputs]);
  const byLine = new Map(calc.lines.map((l) => [l.budgetLineId, l]));

  function setPct(id: string, v: number) {
    setPcts((p) => ({ ...p, [id]: Math.min(1, Math.max(0, v)) }));
  }
  function submit(close: boolean) {
    if (close && !confirm(`Fechar o auto n.º ${number}? Depois de fechado não pode ser alterado; correções vão no auto seguinte.`)) return;
    setError(null);
    startTransition(async () => {
      const r = await saveMeasurement(reportId, inputs, { reportDate: date, notes: notes || null }, close);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }
  function remove() {
    if (!confirm("Apagar este auto em rascunho?")) return;
    startTransition(async () => {
      const r = await deleteDraftMeasurement(reportId);
      if (r && !r.ok) setError(r.error);
    });
  }

  // Agrupar por capítulo para leitura.
  const chapters = [...new Set(leaves.map((l) => l.chapter))];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Orçamentado" value={formatMoney(calc.totalBudget)} />
        <Stat label={`Executado acumulado`} value={formatMoney(calc.totalCumulative)} hint={formatPercent(calc.progress)} strong />
        <Stat label="Executado neste auto" value={formatMoney(calc.totalPeriod)} strong />
        <Stat label="Auto anterior" value={previousNumber ? `n.º ${previousNumber}` : "—"} hint={previousNumber ? "as % vêm pré-preenchidas" : "primeiro auto"} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Período</p>
          <p className="font-medium">{monthLabel(periodMonth)}</p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Data do auto
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={closed} className="w-40" />
        </label>
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Notas
          <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={closed} />
        </label>
        {closed ? (
          <span className="flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-xs font-medium text-success"><Lock className="size-3.5" /> Fechado</span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="w-16 px-2 py-2 text-left">Cód.</th>
              <th className="px-2 py-2 text-left">Artigo</th>
              <th className="w-28 px-2 py-2 text-right">Orçamentado</th>
              <th className="w-20 px-2 py-2 text-right">% anterior</th>
              <th className="w-24 px-2 py-2 text-right">% acumulada</th>
              <th className="w-28 px-2 py-2 text-right">Acumulado</th>
              <th className="w-28 px-2 py-2 text-right">Neste auto</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((ch) => (
              <ChapterRows key={ch} chapter={ch} rows={leaves.filter((l) => l.chapter === ch)} byLine={byLine} pcts={pcts} setPct={setPct} closed={closed} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-semibold">
              <td colSpan={2} className="px-2 py-2 text-right">Total</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(calc.totalBudget)}</td>
              <td />
              <td className="px-2 py-2 text-right tabular-nums">{formatPercent(calc.progress)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(calc.totalCumulative)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(calc.totalPeriod)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!closed ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {error ? <span className="mr-auto text-xs text-destructive">{error}</span> : null}
          <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={remove} disabled={pending}><Trash2 className="size-4" /> Apagar rascunho</Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={pending}>{pending ? "…" : "Guardar rascunho"}</Button>
          <Button onClick={() => submit(true)} disabled={pending} className="gap-1"><Check className="size-4" /> Fechar auto</Button>
        </div>
      ) : error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-lg tabular-nums", strong && "font-semibold")}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ChapterRows({ chapter, rows, byLine, pcts, setPct, closed }: {
  chapter: string;
  rows: MeasurementLeafView[];
  byLine: Map<string, { amountCumulative: number; amountPeriod: number }>;
  pcts: Record<string, number>;
  setPct: (id: string, v: number) => void;
  closed: boolean;
}) {
  const sumB = rows.reduce((a, r) => a + r.budgeted, 0);
  const sumC = rows.reduce((a, r) => a + (byLine.get(r.budgetLineId)?.amountCumulative ?? 0), 0);
  const sumP = rows.reduce((a, r) => a + (byLine.get(r.budgetLineId)?.amountPeriod ?? 0), 0);
  return (
    <>
      <tr className="border-t bg-muted/30 font-medium">
        <td colSpan={2} className="px-2 py-1.5">{chapter}</td>
        <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(sumB)}</td>
        <td />
        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{sumB ? formatPercent(sumC / sumB) : "—"}</td>
        <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(sumC)}</td>
        <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(sumP)}</td>
      </tr>
      {rows.map((r) => {
        const c = byLine.get(r.budgetLineId);
        const pct = pcts[r.budgetLineId] ?? 0;
        return (
          <tr key={r.budgetLineId} className="border-t">
            <td className="px-2 py-1 font-mono text-xs text-muted-foreground">{r.code}</td>
            <td className="px-2 py-1"><span className="line-clamp-2">{r.description}</span></td>
            <td className="px-2 py-1 text-right tabular-nums">{formatMoney(r.budgeted)}</td>
            <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{Math.round(r.previousPct * 100)} %</td>
            <td className="px-2 py-1 text-right">
              <span className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(pct * 1000) / 10}
                  disabled={closed}
                  onChange={(e) => setPct(r.budgetLineId, Number(e.target.value || 0) / 100)}
                  onFocus={(e) => e.target.select()}
                  className={cn("h-7 w-16 rounded border bg-background px-1.5 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60", pct < r.previousPct && "border-warning")}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </span>
            </td>
            <td className="px-2 py-1 text-right tabular-nums">{formatMoney(c?.amountCumulative ?? 0)}</td>
            <td className={cn("px-2 py-1 text-right tabular-nums", (c?.amountPeriod ?? 0) < 0 && "text-destructive")}>{formatMoney(c?.amountPeriod ?? 0)}</td>
          </tr>
        );
      })}
    </>
  );
}
