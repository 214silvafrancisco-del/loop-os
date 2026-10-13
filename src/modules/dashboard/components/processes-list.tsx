import Link from "next/link";
import { formatDate } from "@/core/lib/format";
import { cn } from "@/lib/utils";
import { PROCESS_KIND_LABEL, type ProcessRow } from "../queries";

/**
 * Processos (negócio, obra, venda) com estado, responsável global e próxima tarefa.
 * Distingue quem é responsável pelo processo de quem é responsável pela próxima tarefa.
 */
export function ProcessesList({ rows, today, empty, showOwner }: { rows: ProcessRow[]; today: string; empty: string; showOwner?: boolean }) {
  if (rows.length === 0) return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {rows.map((p) => {
        const t = p.nextTask;
        const overdue = Boolean(t?.dueDate && t.dueDate < today && t.status !== "bloqueada");
        return (
          <li key={`${p.kind}:${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{PROCESS_KIND_LABEL[p.kind]}</span>
            <Link href={p.href} className="min-w-0 truncate font-medium hover:underline">
              {p.label}
            </Link>
            <span className="shrink-0 rounded-full bg-muted px-2 text-[11px] text-muted-foreground">{p.stateLabel}</span>
            {showOwner ? <span className="hidden text-xs text-muted-foreground md:inline">{p.ownerName ?? "sem responsável"}</span> : null}
            <div className="w-full text-xs sm:ml-auto sm:w-auto sm:text-right">
              {t ? (
                <>
                  <span className={cn(t.status === "bloqueada" ? "text-destructive" : "text-foreground")}>{t.title}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {t.assigneeName ?? <span className="text-warning">sem responsável</span>}
                    {t.dueDate ? (
                      <>
                        {" "}
                        · <span className={cn(overdue && "font-medium text-destructive")}>{formatDate(t.dueDate)}</span>
                        {overdue ? <span className="ml-1 rounded-full bg-destructive/10 px-1.5 text-[11px] font-medium text-destructive">atrasada</span> : null}
                      </>
                    ) : null}
                    {t.status === "bloqueada" ? <span className="ml-1 rounded-full bg-destructive/10 px-1.5 text-[11px] font-medium text-destructive">bloqueada</span> : null}
                  </span>
                </>
              ) : (
                <span className="rounded-full bg-warning/15 px-2 text-[11px] font-medium text-warning">sem próxima tarefa</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
