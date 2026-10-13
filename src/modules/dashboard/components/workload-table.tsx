import Link from "next/link";
import { cn } from "@/lib/utils";
import type { WorkloadRow } from "../queries";

/** Carga de trabalho por colaborador (Founder): tarefas e processos reais, não contagens manuais. */
export function WorkloadTable({ rows }: { rows: WorkloadRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 text-left">Colaborador</th>
            <th className="px-3 py-2 text-right">Abertas</th>
            <th className="px-3 py-2 text-right">Atrasadas</th>
            <th className="px-3 py-2 text-right">7 dias</th>
            <th className="px-3 py-2 text-right">Bloqueadas</th>
            <th className="px-3 py-2 text-right">Concluídas 7d</th>
            <th className="px-3 py-2 text-right">Processos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId ?? "none"} className="border-b last:border-0">
              <td className="px-3 py-2">
                {r.userId ? (
                  <Link href={`/dashboard?u=${r.userId}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  <Link href="/tarefas?owner=none" className="text-muted-foreground hover:underline">
                    {r.name}
                  </Link>
                )}
                {!r.isActive ? <span className="ml-2 text-[11px] text-muted-foreground">(desativado)</span> : null}
              </td>
              <Num n={r.open} />
              <Num n={r.overdue} tone="bad" />
              <Num n={r.soon} />
              <Num n={r.blocked} tone="bad" />
              <Num n={r.doneRecent} />
              <Num n={r.owned} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Num({ n, tone }: { n: number; tone?: "bad" }) {
  return <td className={cn("px-3 py-2 text-right tabular-nums", n === 0 ? "text-muted-foreground/60" : tone === "bad" ? "font-medium text-destructive" : "")}>{n}</td>;
}
