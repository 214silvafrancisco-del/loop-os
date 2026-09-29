"use client";

import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/core/lib/format";
import type { ScenarioOutputs } from "../calc";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "muted" }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-base font-semibold tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Painel fixo no topo de cada cenário com os resultados ao vivo. */
export function ResultsPanel({ o, targetRoe }: { o: ScenarioOutputs; targetRoe: number }) {
  const profitTone = o.netProfit > 0 ? "good" : o.netProfit < 0 ? "bad" : "muted";
  const roeTone = o.roe >= targetRoe ? "good" : o.roe > 0 ? undefined : "bad";
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
      <Stat label="Lucro líquido" value={formatCurrency(o.netProfit)} tone={profitTone} />
      <Stat label="ROE (cash-on-cash)" value={formatPercent(o.roe)} tone={roeTone} />
      <Stat label="Anualizado" value={formatPercent(o.annualized)} />
      <Stat label="Lucro bruto" value={formatCurrency(o.grossProfit)} />
      <Stat label="ROI" value={formatPercent(o.roi)} />
      <Stat label="Margem" value={formatPercent(o.margin)} />
      <Stat label="Capital próprio" value={formatCurrency(o.equity)} />
      <Stat label="Investimento total" value={formatCurrency(o.totalInvestment)} />
      <Stat label="Break-even" value={formatCurrency(o.breakEvenPrice)} />
    </div>
  );
}
