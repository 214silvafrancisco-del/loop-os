import Link from "next/link";
import { formatDate } from "@/core/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TASK_ENTITY_LABEL } from "@/modules/tasks/alerts";
import type { TaskListRow } from "@/modules/tasks/queries";
import { PROCESS_KIND_LABEL, type ProcessRow, type TaskStats } from "../queries";

/**
 * O que pede intervenção nos módulos acessíveis: processos sem próxima tarefa,
 * tarefas sem responsável, bloqueadas e atrasadas. Só contagens e os primeiros casos.
 */
export function AttentionPanel({
  stats,
  withoutTask,
  unassigned,
  blocked,
  overdue,
  owner,
}: {
  stats: TaskStats;
  withoutTask: ProcessRow[];
  unassigned: TaskListRow[];
  blocked: TaskListRow[];
  overdue: TaskListRow[];
  /** Filtro de responsável nos links para a lista de tarefas (vista por colaborador). */
  owner?: string;
}) {
  const base = owner ? `/tarefas?owner=${owner}` : "/tarefas?x=1";
  const nothing = withoutTask.length === 0 && stats.unassigned === 0 && stats.blocked === 0 && stats.overdue === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Exigem atenção</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {nothing ? <p className="text-sm text-muted-foreground">Nada em falta: todos os processos têm próxima tarefa e não há atrasos.</p> : null}
        {stats.overdue > 0 ? (
          <Section title="Tarefas atrasadas" count={stats.overdue} href={`${base}&overdue=1`} tone="bad">
            {overdue.map((t) => (
              <TaskLine key={t.id} t={t} />
            ))}
          </Section>
        ) : null}
        {withoutTask.length > 0 ? (
          <Section title="Processos sem próxima tarefa" count={withoutTask.length} tone="warn">
            {withoutTask.map((p) => (
              <li key={`${p.kind}:${p.id}`} className="flex items-center gap-2 text-sm">
                <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{PROCESS_KIND_LABEL[p.kind]}</span>
                <Link href={p.href} className="min-w-0 truncate hover:underline">
                  {p.label}
                </Link>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{p.stateLabel}</span>
              </li>
            ))}
          </Section>
        ) : null}
        {stats.blocked > 0 ? (
          <Section title="Tarefas bloqueadas" count={stats.blocked} href={`${base}&status=bloqueada`} tone="bad">
            {blocked.map((t) => (
              <TaskLine key={t.id} t={t} />
            ))}
          </Section>
        ) : null}
        {!owner && stats.unassigned > 0 ? (
          <Section title="Tarefas sem responsável" count={stats.unassigned} href="/tarefas?owner=none" tone="warn">
            {unassigned.map((t) => (
              <TaskLine key={t.id} t={t} />
            ))}
          </Section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Section({ title, count, href, tone, children }: { title: string; count: number; href?: string; tone: "bad" | "warn"; children: React.ReactNode }) {
  const heading = (
    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
      <span className={tone === "bad" ? "text-destructive" : "text-warning"}>{title}</span>
      <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{count}</span>
    </span>
  );
  return (
    <div>
      {href ? (
        <Link href={href} className="hover:underline">
          {heading}
        </Link>
      ) : (
        heading
      )}
      <ul className="mt-1.5 flex flex-col gap-1">{children}</ul>
    </div>
  );
}

function TaskLine({ t }: { t: TaskListRow }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{TASK_ENTITY_LABEL[t.entityType]}</span>
      <span className="min-w-0 truncate">
        {t.href ? (
          <Link href={t.href} className="hover:underline">
            {t.entityLabel}
          </Link>
        ) : (
          <span className="text-muted-foreground">{t.entityLabel}</span>
        )}
        <span className="text-muted-foreground"> · {t.title}</span>
      </span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {t.assigneeName ?? "—"}
        {t.dueDate ? ` · ${formatDate(t.dueDate)}` : ""}
      </span>
    </li>
  );
}
