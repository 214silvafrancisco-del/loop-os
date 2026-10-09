import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/core/lib/format";
import type { Forecast, Interval } from "../forecast";

function Tile({ label, v }: { label: string; v: Interval }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {v.expected}
        <span className="ml-1 text-xs font-normal text-muted-foreground">prev.</span>
      </p>
      <p className="text-xs text-muted-foreground">
        entre {v.low} e {v.high}
      </p>
    </div>
  );
}

const RELIABILITY: Record<"baixa" | "media" | "boa", { label: string; cls: string }> = {
  baixa: { label: "fiabilidade baixa", cls: "bg-destructive/10 text-destructive" },
  media: { label: "fiabilidade média", cls: "bg-warning/15 text-warning" },
  boa: { label: "fiabilidade boa", cls: "bg-success/10 text-success" },
};

const pct = (v: number | null) => (v === null ? "—" : formatPercent(v));
const num = (v: number | null) => (v === null ? "—" : (Math.round(v * 10) / 10).toString());

/** Previsão de compras derivada do funil. Os blocos a tracejado são previsões, não valores reais. */
export function ForecastPanel({ f }: { f: Forecast }) {
  if (f.status === "insufficient") {
    return (
      <div className="rounded-xl border border-dashed bg-card p-4 text-sm">
        <p className="font-medium">Dados insuficientes para uma previsão fiável</p>
        <p className="mt-1 text-muted-foreground">
          Há {f.filledWeeks} {f.filledWeeks === 1 ? "semana completa" : "semanas completas"} com compras preenchidas; são precisas pelo menos {f.minimumWeeks}. Preenche as semanas anteriores em «Ver histórico completo».
        </p>
      </div>
    );
  }
  const rel = RELIABILITY[f.reliability];
  const TrendIcon = f.trend?.direction === "up" ? ArrowUpRight : f.trend?.direction === "down" ? ArrowDownRight : Minus;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label="Próxima semana" v={f.nextWeek} />
        <Tile label="Próximas 4 semanas" v={f.fourWeeks} />
        <Tile label="Próximos 3 meses" v={f.threeMonths} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className={cn("rounded-full px-2 py-0.5 font-medium", rel.cls)}>{rel.label}</span>
        <span>
          ritmo {num(f.weeklyRate)} compras/semana · {f.filledWeeks} semanas de histórico
        </span>
        {f.trend ? (
          <span className={cn("inline-flex items-center gap-1", f.trend.direction === "up" ? "text-success" : f.trend.direction === "down" ? "text-destructive" : "")}>
            <TrendIcon className="size-3.5" />
            {f.trend.direction === "flat" ? "estável" : f.trend.direction === "up" ? "a subir" : "a descer"}: {num(f.trend.recentAvg)} nas últimas 4 vs {num(f.trend.previousAvg)} nas {f.trend.weeks} anteriores
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Médias semanais: {num(f.averages.leads)} leads · {num(f.averages.visits)} visitas · {num(f.averages.proposals)} propostas · {num(f.averages.purchases)} compras. Conversão aproximada (agregada, sem desfasamento): lead→visita {pct(f.conversion.visitsPerLead)}, visita→proposta {pct(f.conversion.proposalsPerVisit)}, proposta→compra {pct(f.conversion.purchasesPerProposal)}, lead→compra {pct(f.conversion.purchasesPerLead)}.
        {f.funnelRate !== null ? ` O funil recente ajusta o ritmo histórico (${num(f.baseRate)}) para ${num(f.weeklyRate)}.` : ""}
        {f.reliabilityNotes.length ? ` Nota: ${f.reliabilityNotes.join("; ")}.` : ""}
      </p>
    </div>
  );
}
