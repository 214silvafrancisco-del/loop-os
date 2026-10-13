import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate } from "@/core/lib/format";
import { TASK_ENTITY_LABEL } from "@/modules/tasks/alerts";
import { NextTaskControl } from "@/modules/tasks/components/next-task-control";
import type { TaskListRow } from "@/modules/tasks/queries";

/** Lista de próximas tarefas do dashboard: atrasadas, hoje, esta semana. */
export function ActionsList({ tasks, today }: { tasks: TaskListRow[]; today: string }) {
  if (tasks.length === 0) {
    return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nada agendado para esta semana.</p>;
  }
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {tasks.map((t) => {
        const overdue = Boolean(t.dueDate && t.dueDate < today);
        const isToday = t.dueDate === today;
        return (
          <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span
              className={cn("size-2 shrink-0 rounded-full", t.status === "bloqueada" || overdue ? "bg-destructive" : isToday ? "bg-primary" : "bg-muted-foreground/40")}
              title={t.status === "bloqueada" ? "Bloqueada" : overdue ? "Atrasada" : isToday ? "Hoje" : "Esta semana"}
            />
            <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">{TASK_ENTITY_LABEL[t.entityType]}</span>
            <Link href={t.href} className="min-w-0 truncate font-medium hover:underline">
              {t.entityLabel}
            </Link>
            {t.assigneeName ? <span className="hidden text-xs text-muted-foreground md:inline">{t.assigneeName}</span> : <span className="text-xs text-warning">sem responsável</span>}
            <span className={cn("hidden text-xs md:inline", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>{t.dueDate ? formatDate(t.dueDate) : ""}</span>
            <div className="w-full sm:ml-auto sm:w-80">
              <NextTaskControl
                entityType={t.entityType}
                entityId={t.entityId}
                task={{ id: t.id, title: t.title, dueDate: t.dueDate, status: t.status, assigneeUserId: t.assigneeUserId, assigneeName: t.assigneeName, openCount: 1 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
