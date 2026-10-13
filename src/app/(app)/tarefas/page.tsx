import type { Metadata } from "next";
import Link from "next/link";
import { allowedTaskEntities } from "@/core/auth/access";
import { requireUser } from "@/core/auth/current-user";
import { formatDate } from "@/core/lib/format";
import { PageHeader } from "@/core/ui/page-header";
import { NativeSelect } from "@/core/ui/form-field";
import { cn } from "@/lib/utils";
import { todayIso } from "@/modules/deals/utils";
import { TASK_ALERT_LABEL, TASK_ENTITY_LABEL, TASK_STATUSES } from "@/modules/tasks/alerts";
import { NextTaskControl } from "@/modules/tasks/components/next-task-control";
import { countTaskAlerts, listTasks } from "@/modules/tasks/queries";
import type { TaskEntity, TaskStatus } from "@/modules/tasks/schema";
import { listUsers } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Tarefas" };

type Search = { owner?: string; module?: string; status?: string; until?: string; overdue?: string };
const ENTITIES: TaskEntity[] = ["deal", "project", "sale", "sale_lead"];

/** Todas as tarefas da organização, com filtros. (Fase 3 restringe aos módulos acessíveis.) */
export default async function TasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayIso();
  const status = (TASK_STATUSES.some((s) => s.value === sp.status) ? sp.status : "abertas") as TaskStatus | "abertas";
  const entityType = ENTITIES.includes(sp.module as TaskEntity) ? (sp.module as TaskEntity) : undefined;
  const [tasks, users, counts] = await Promise.all([
    listTasks(user.organizationId, { assigneeUserId: sp.owner || undefined, entityType, status, dueUntil: sp.until || undefined, overdueOnly: sp.overdue === "1", allowedEntityTypes: allowedTaskEntities(user), viewerUserId: user.id }, today),
    listUsers(user.organizationId),
    countTaskAlerts(user.organizationId, today, user.role === "admin" ? undefined : user.id),
  ]);

  const chip = (label: string, n: number, href: string, tone?: string) => (
    <Link href={href} className={cn("flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent", tone)}>
      <span className="font-medium">{label}</span>
      <span className="tabular-nums text-muted-foreground">{n}</span>
    </Link>
  );

  return (
    <>
      <PageHeader title="Tarefas" description="O que tem de ser feito, por quem e até quando. Em todos os negócios, obras, vendas e leads." />
      <div className="mb-4 flex flex-wrap gap-2">
        {chip("Abertas", counts.open, "/tarefas")}
        {chip("Atrasadas", counts.overdue, "/tarefas?overdue=1", counts.overdue ? "border-destructive/40" : undefined)}
        {chip("Próximos 7 dias", counts.soon, `/tarefas?until=${addDays(today, 7)}`)}
        {chip("Sem responsável", counts.unassigned, "/tarefas?owner=none", counts.unassigned ? "border-warning/60" : undefined)}
        {chip("Bloqueadas", counts.blocked, "/tarefas?status=bloqueada", counts.blocked ? "border-destructive/40" : undefined)}
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <NativeSelect name="owner" defaultValue={sp.owner ?? ""} className="h-10 w-auto md:h-9" aria-label="Responsável">
          <option value="">Responsável</option>
          <option value="none">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="module" defaultValue={sp.module ?? ""} className="h-10 w-auto md:h-9" aria-label="Módulo">
          <option value="">Módulo</option>
          {allowedTaskEntities(user).map((e) => (
            <option key={e} value={e}>
              {TASK_ENTITY_LABEL[e]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={sp.status ?? "abertas"} className="h-10 w-auto md:h-9" aria-label="Estado">
          <option value="abertas">Abertas</option>
          {TASK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
        <input type="date" name="until" defaultValue={sp.until ?? ""} aria-label="Prazo até" className="h-10 rounded-md border bg-transparent px-3 text-sm md:h-9" />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} className="size-4 accent-primary" /> só atrasadas
        </label>
        <button type="submit" className="h-10 rounded-md border bg-card px-3 text-sm hover:bg-accent md:h-9">
          Filtrar
        </button>
      </form>

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Sem tarefas para estes filtros.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{TASK_ENTITY_LABEL[t.entityType]}</span>
              {t.href ? (
                <Link href={t.href} className="min-w-0 truncate font-medium hover:underline">
                  {t.entityLabel}
                </Link>
              ) : (
                <span className="min-w-0 truncate text-muted-foreground">{t.entityLabel}</span>
              )}
              {t.alert ? (
                <span className={cn("rounded-full px-1.5 text-[11px] font-medium", t.alert === "proxima" ? "bg-primary/10 text-primary" : t.alert === "sem_responsavel" ? "bg-warning/15 text-warning" : "bg-destructive/10 text-destructive")}>
                  {TASK_ALERT_LABEL[t.alert]}
                </span>
              ) : null}
              {t.status === "concluida" ? <span className="text-xs text-muted-foreground">concluída {t.completedAt ? formatDate(t.completedAt) : ""}</span> : null}
              <div className="w-full sm:ml-auto sm:w-80">
                {t.status === "concluida" ? (
                  <p className="px-2 text-xs text-muted-foreground">{t.title}</p>
                ) : (
                  <NextTaskControl entityType={t.entityType} entityId={t.entityId} task={{ id: t.id, title: t.title, dueDate: t.dueDate, status: t.status, assigneeUserId: t.assigneeUserId, assigneeName: t.assigneeName, openCount: 1 }} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
