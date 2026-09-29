import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/core/lib/format";

export type ProjectSummaryData = {
  projectId: string;
  budgeted: number;
  executed: number;
  invoiced: number;
  paid: number;
  lastMeasurement: { number: number; month: string } | null;
};

function Card({ label, value, hint, href, tone }: { label: string; value: string; hint?: string; href: string; tone?: "warn" | "bad" }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums", tone === "bad" && "text-destructive", tone === "warn" && "text-warning")}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Link>
  );
}

/** Orçamentado / Executado / Faturado / Pago / Por pagar / Desvio da obra. */
export function ProjectSummary({ s }: { s: ProjectSummaryData }) {
  const base = `/projects/${s.projectId}`;
  const deviation = s.invoiced - s.budgeted;
  const unpaid = s.invoiced - s.paid;
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Card label="Orçamentado" value={formatMoney(s.budgeted)} hint="sem IVA" href={`${base}/orcamento`} />
      <Card
        label="Executado"
        value={formatMoney(s.executed)}
        hint={s.budgeted ? `${formatPercent(s.executed / s.budgeted)}${s.lastMeasurement ? ` · auto ${s.lastMeasurement.number}` : ""}` : "sem autos"}
        href={`${base}/autos`}
      />
      <Card label="Faturado" value={formatMoney(s.invoiced)} hint={s.invoiced > s.executed && s.executed > 0 ? "acima do executado" : undefined} href={`${base}/faturas`} tone={s.invoiced > s.executed && s.executed > 0 ? "warn" : undefined} />
      <Card label="Pago" value={formatMoney(s.paid)} href={`${base}/faturas`} />
      <Card label="Por pagar" value={formatMoney(unpaid)} href={`${base}/faturas`} tone={unpaid > 0 ? "warn" : undefined} />
      <Card label="Desvio" value={`${deviation > 0 ? "+" : ""}${formatMoney(deviation)}`} hint="faturado − orçamentado" href={`${base}/faturas`} tone={deviation > 0 ? "bad" : undefined} />
    </div>
  );
}
