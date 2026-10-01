import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/core/lib/format";
import type { SalePnl } from "../pnl-queries";
import type { PnlRow } from "../pnl";

function cell(v: number | null, kind: PnlRow["kind"]) {
  if (v === null) return "—";
  if (kind === "pct") return formatPercent(v);
  if (kind === "months") return `${v} ${v === 1 ? "mês" : "meses"}`;
  return formatCurrency(v);
}

function diff(row: PnlRow) {
  if (row.bp === null || row.real === null) return null;
  const d = row.real - row.bp;
  if (row.kind === "pct") return { text: `${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)} pp`, good: d >= 0 };
  if (row.kind === "months") return { text: `${d >= 0 ? "+" : ""}${Math.round(d * 10) / 10}`, good: d <= 0 };
  return { text: `${d >= 0 ? "+" : ""}${formatCurrency(d)}`, good: row.cost ? d <= 0 : d >= 0 };
}

/** Tabela BP ativo vs real, com desvio. Em telemóvel cada linha empilha os três valores. */
export function PnlTable({ pnl }: { pnl: SalePnl }) {
  const strong = new Set(["totalInvestment", "grossProfit", "netProfit"]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {pnl.scenarioName ? <>Business Plan: cenário «{pnl.scenarioName}». </> : null}
          {pnl.final ? "Real com a venda escriturada." : "Real provisório: receita pelo preço anunciado e duração até hoje."}
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="hidden text-xs text-muted-foreground md:table-header-group">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Rubrica</th>
              <th className="px-3 py-2 text-right font-medium">Business Plan</th>
              <th className="px-3 py-2 text-right font-medium">Real</th>
              <th className="px-3 py-2 text-right font-medium">Desvio</th>
            </tr>
          </thead>
          <tbody>
            {pnl.rows.map((row) => {
              const d = diff(row);
              const isStrong = strong.has(row.key);
              return (
                <tr key={row.key} className={cn("border-b last:border-0", isStrong && "bg-muted/40 font-semibold")}>
                  <td className="px-3 py-2">
                    {row.label}
                    <dl className="mt-1 grid grid-cols-3 gap-2 text-xs font-normal md:hidden">
                      <div><dt className="text-muted-foreground">BP</dt><dd className="tabular-nums">{cell(row.bp, row.kind)}</dd></div>
                      <div><dt className="text-muted-foreground">Real</dt><dd className={cn("tabular-nums", isStrong && "font-semibold")}>{cell(row.real, row.kind)}</dd></div>
                      <div><dt className="text-muted-foreground">Desvio</dt><dd className={cn("tabular-nums", d && (d.good ? "text-success" : "text-destructive"))}>{d?.text ?? "—"}</dd></div>
                    </dl>
                  </td>
                  <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground md:table-cell">{cell(row.bp, row.kind)}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{cell(row.real, row.kind)}</td>
                  <td className={cn("hidden px-3 py-2 text-right tabular-nums md:table-cell", d && (d.good ? "text-success" : "text-destructive"))}>{d?.text ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pnl.notes.length ? (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {pnl.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">Aquisição real = valor final de compra + custos reais de aquisição (ficha do negócio). Obra real = faturas registadas, com IVA. Detenção e financiamento reais vêm do Resumo. Imposto estimado com a taxa do cenário.</p>
    </div>
  );
}
