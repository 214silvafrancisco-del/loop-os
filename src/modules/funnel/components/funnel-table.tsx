"use client";

import { Check, Loader2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveFunnelWeek, applySuggestedFunnelWeek } from "../actions";
import type { FunnelTableRow } from "../queries";
import { weekLabel } from "../weeks";

const COLS = [
  { key: "leads", label: "Leads", help: "negócios entrados" },
  { key: "visits", label: "Visitas", help: "passaram a Visita" },
  { key: "proposals", label: "Propostas", help: "propostas apresentadas" },
  { key: "purchases", label: "Compras", help: "negócios adquiridos" },
] as const;
type Key = (typeof COLS)[number]["key"];

type Values = Record<Key, string>;
const toValues = (r: FunnelTableRow): Values => ({ leads: r.leads?.toString() ?? "", visits: r.visits?.toString() ?? "", proposals: r.proposals?.toString() ?? "", purchases: r.purchases?.toString() ?? "" });

function Row({ row, mode }: { row: FunnelTableRow; mode: "table" | "card" }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => toValues(row));
  const [seen, setSeen] = useState(row);
  if (seen !== row) {
    setSeen(row);
    setValues(toValues(row));
  }
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const filled = COLS.some((c) => values[c.key] !== "");
  const differs = COLS.some((c) => values[c.key] !== String(row.suggested[c.key]));

  function save(next: Values) {
    setState("saving");
    startTransition(async () => {
      const r = await saveFunnelWeek({ weekStart: row.weekStart, ...next });
      if (r.ok) {
        setState("saved");
        setError(null);
        router.refresh();
      } else {
        setState("error");
        setError(r.error);
      }
    });
  }
  function onBlur(key: Key, raw: string) {
    const v = raw.trim();
    const next = { ...values, [key]: v };
    setValues(next);
    if (v === (row[key]?.toString() ?? "")) return; // sem alteração
    save(next);
  }
  function useSuggested() {
    setState("saving");
    startTransition(async () => {
      const r = await applySuggestedFunnelWeek(row.weekStart);
      if (r.ok) {
        setState("saved");
        router.refresh();
      } else {
        setState("error");
        setError(r.error);
      }
    });
  }

  const input = (c: (typeof COLS)[number]) => (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      aria-label={`${c.label} na semana ${weekLabel(row.weekStart)}`}
      value={values[c.key]}
      placeholder={`sug. ${row.suggested[c.key]}`}
      onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.value }))}
      onBlur={(e) => onBlur(c.key, e.target.value)}
      onFocus={(e) => e.target.select()}
      disabled={pending}
      className={cn(
        "h-10 w-full rounded-md border bg-background px-2 text-right text-base tabular-nums outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-8 md:text-sm",
        values[c.key] === "" && "border-dashed",
      )}
    />
  );
  const status =
    state === "saving" ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : state === "saved" ? <Check className="size-3.5 text-success" /> : state === "error" ? <span className="text-xs text-destructive">{error}</span> : null;
  const suggestBtn =
    row.isComplete || row.isCurrent ? (
      <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs md:h-7" onClick={useSuggested} disabled={pending || (filled && !differs)} title="Preencher com os valores que a app conta (negócios, fases, propostas)">
        <Wand2 className="size-3.5" /> usar valores da app
      </Button>
    ) : null;

  if (mode === "card") {
    return (
      <li className={cn("rounded-xl border bg-card p-3", row.isCurrent && "border-primary/50")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {row.isCurrent ? "Semana atual · " : ""}
            {weekLabel(row.weekStart)}
          </span>
          {status}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {COLS.map((c) => (
            <label key={c.key} className="text-[11px] text-muted-foreground">
              {c.label}
              {input(c)}
            </label>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{filled ? "" : "por preencher"}</span>
          {suggestBtn}
        </div>
      </li>
    );
  }
  return (
    <tr className={cn("border-b last:border-0", row.isCurrent && "bg-primary/5")}>
      <td className="px-3 py-2 text-sm">
        <div className="font-medium">{row.isCurrent ? "Semana atual" : weekLabel(row.weekStart)}</div>
        <div className="text-xs text-muted-foreground">{row.isCurrent ? weekLabel(row.weekStart) : filled ? "" : "por preencher"}</div>
      </td>
      {COLS.map((c) => (
        <td key={c.key} className="w-24 px-2 py-1.5">
          {input(c)}
        </td>
      ))}
      <td className="px-2 py-1.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {status}
          {suggestBtn}
        </div>
      </td>
    </tr>
  );
}

/** Tabela do funil semanal com edição direta. Em telemóvel, um cartão por semana. */
export function FunnelTable({ rows, historyHref }: { rows: FunnelTableRow[]; historyHref?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <Row key={r.weekStart} row={r} mode="card" />
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Semana</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-right font-medium" title={c.help}>
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.weekStart} row={r} mode="table" />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Volume de cada fase na semana (segunda a domingo). Vazio = por preencher; «sug.» é o que a app conta sozinha.</span>
        {historyHref ? (
          <Link href={historyHref} className="font-medium text-primary hover:underline">
            Ver histórico completo
          </Link>
        ) : null}
      </div>
    </div>
  );
}
