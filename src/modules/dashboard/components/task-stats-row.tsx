import Link from "next/link";
import { cn } from "@/lib/utils";
import { addDaysIso, SOON_DAYS } from "@/modules/tasks/alerts";
import type { TaskStats } from "../queries";

/**
 * Contagens de tarefas em chips que levam à lista filtrada.
 * `owner`: id do responsável (filtro da lista) ou nada para toda a organização.
 */
export function TaskStatsRow({ stats, today, owner }: { stats: TaskStats; today: string; owner?: string }) {
  const base = owner ? `/tarefas?owner=${owner}` : "/tarefas?x=1";
  const chip = (label: string, n: number, href: string, tone?: "bad" | "warn" | "ok") => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent",
        n > 0 && tone === "bad" && "border-destructive/40",
        n > 0 && tone === "warn" && "border-warning/60",
      )}
    >
      <span className="font-medium">{label}</span>
      <span className={cn("tabular-nums", n > 0 && tone === "bad" ? "font-semibold text-destructive" : "text-muted-foreground")}>{n}</span>
    </Link>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {chip("Por iniciar", stats.porIniciar, `${base}&status=por_iniciar`)}
      {chip("Em curso", stats.emCurso, `${base}&status=em_curso`)}
      {chip("Atrasadas", stats.overdue, `${base}&overdue=1`, "bad")}
      {chip(`Próximos ${SOON_DAYS} dias`, stats.soon, `${base}&until=${addDaysIso(today, SOON_DAYS)}`)}
      {chip("Bloqueadas", stats.blocked, `${base}&status=bloqueada`, "bad")}
      {owner ? null : chip("Sem responsável", stats.unassigned, "/tarefas?owner=none", "warn")}
      {chip("Concluídas (7 dias)", stats.doneRecent, `${base}&status=concluida`, "ok")}
    </div>
  );
}
