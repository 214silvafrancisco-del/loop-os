"use client";

import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/core/lib/format";
import { meetsTarget, type ScenarioOutputs } from "../calc";

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
export function ResultsPanel({ o, targetReturn }: { o: ScenarioOutputs; targetReturn: number }) {
  const profitTone = o.netProfit > 0 ? "good" : o.netProfit < 0 ? "bad" : "muted";
  const valid = meetsTarget(o, targetReturn);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className={cn("mb-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium", valid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
        <span>{valid ? "Negócio válido" : "Abaixo do alvo"}</span>
        <span className="tabular-nums">
          anualizado {formatPercent(o.annualized)} · alvo {formatPercent(targetReturn)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      <Stat label="Lucro líquido" value={formatCurrency(o.netProfit)} tone={profitTone} />
      <Stat label="Retorno anualizado" value={formatPercent(o.annualized)} tone={valid ? "good" : "bad"} />
      <Stat label="ROE (cash-on-cash)" value={formatPercent(o.roe)} />
      <Stat label="Lucro bruto" value={formatCurrency(o.grossProfit)} />
      <Stat label="ROI" value={formatPercent(o.roi)} />
      <Stat label="Margem" value={formatPercent(o.margin)} />
      <Stat label="Capital próprio" value={formatCurrency(o.equity)} />
      <Stat label="Investimento total" value={formatCurrency(o.totalInvestment)} />
      <Stat label="Break-even" value={formatCurrency(o.breakEvenPrice)} />
      </div>
    </div>
  );
}
