import Link from "next/link";
import { allowedTaskEntities, hasModule } from "@/core/auth/access";
import type { CurrentUser } from "@/core/auth/current-user";
import { formatDate } from "@/core/lib/format";
import { addDaysIso } from "@/modules/tasks/alerts";
import { listTasks, type TaskListRow } from "@/modules/tasks/queries";
import { ForecastPanel } from "@/modules/funnel/components/forecast-panel";
import { FunnelTable } from "@/modules/funnel/components/funnel-table";
import { getFunnelForecast, listRecentFunnelWeeks } from "@/modules/funnel/queries";
import { listDealStages } from "@/modules/settings/queries";
import { getModuleIndicators, getTaskStats, listOwnedProcesses, listProcessesWithoutTask, listRecentActivity, listUserNames } from "../queries";
import { ActionsList } from "./actions-list";
import { ActivityFeed } from "./activity-feed";
import { AttentionPanel } from "./attention-panel";
import { ModuleIndicatorsGrid } from "./module-indicators";
import { ProcessesList } from "./processes-list";
import { TaskStatsRow } from "./task-stats-row";

const MAX_TASKS = 12;

/**
 * Dashboard operacional de uma pessoa (Fase 4): as suas tarefas, os seus processos,
 * o que exige atenção nos módulos acessíveis, indicadores e atividade recente.
 * `viewer` decide o que é visível (módulos); `subject` é a pessoa cujas tarefas se mostram.
 * `isSelf` = o próprio a ver-se; falso na vista por colaborador do Founder, que foca só nessa pessoa.
 */
export async function PersonalDashboard({ viewer, subject, today, isSelf }: { viewer: CurrentUser; subject: { id: string; fullName: string }; today: string; isSelf: boolean }) {
  const orgId = viewer.organizationId;
  const allowed = allowedTaskEntities(viewer);
  const mine = { assigneeUserId: subject.id, allowedEntityTypes: allowed, viewerUserId: subject.id } as const;
  const scope = isSelf ? { allowedEntityTypes: allowed, viewerUserId: subject.id } : mine;
  const showFunnel = isSelf && hasModule(viewer, "funil");

  const [stats, attentionStats, open, done, owned, withoutTaskAll, overdue, blocked, unassigned, indicators, activity, userNames, stages, funnel, forecast] = await Promise.all([
    getTaskStats(orgId, today, { assigneeUserId: subject.id }),
    isSelf ? getTaskStats(orgId, today, { entityTypes: allowed }) : getTaskStats(orgId, today, { assigneeUserId: subject.id }),
    listTasks(orgId, { ...mine, status: "abertas", limit: 100 }, today),
    listTasks(orgId, { ...mine, status: "concluida", limit: 40 }, today),
    listOwnedProcesses(orgId, subject.id, viewer),
    isSelf ? listProcessesWithoutTask(orgId, viewer) : [],
    listTasks(orgId, { ...scope, status: "abertas", overdueOnly: true, limit: 6 }, today),
    listTasks(orgId, { ...scope, status: "bloqueada", limit: 6 }, today),
    isSelf ? listTasks(orgId, { assigneeUserId: "none", status: "abertas", allowedEntityTypes: allowed, limit: 6 }, today) : [],
    isSelf ? getModuleIndicators(orgId, viewer, today) : [],
    listRecentActivity(orgId, viewer, isSelf ? { forUserId: subject.id, limit: 15 } : { aboutUserId: subject.id, limit: 15 }),
    listUserNames(orgId),
    listDealStages(orgId),
    showFunnel ? listRecentFunnelWeeks(orgId, today, 2) : null,
    showFunnel ? getFunnelForecast(orgId, today) : null,
  ]);

  const recentStart = addDaysIso(today, -7);
  const doneRecent = done
    .filter((t) => t.completedAt && t.completedAt.toISOString().slice(0, 10) >= recentStart)
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .slice(0, 6);
  const withoutTask = isSelf ? withoutTaskAll : owned.filter((p) => !p.nextTask);
  const ownedKeys = new Set(owned.map((p) => `${p.kind}:${p.id}`));
  const withMyTasks = groupByEntity(open.filter((t) => !ownedKeys.has(`${t.entityType}:${t.entityId}`)));
  const lookups = { users: userNames, stages: Object.fromEntries(stages.map((s) => [s.id, s.name])) };
  const first = subject.fullName.split(" ")[0] ?? subject.fullName;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{isSelf ? "As minhas tarefas" : `Tarefas de ${first}`}</h2>
              <Link href={`/tarefas?owner=${subject.id}`} className="text-xs text-muted-foreground hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="mb-3">
              <TaskStatsRow stats={stats} today={today} owner={subject.id} />
            </div>
            <ActionsList tasks={open.slice(0, MAX_TASKS)} today={today} empty={isSelf ? "Não tem tarefas abertas." : `${first} não tem tarefas abertas.`} />
            {open.length > MAX_TASKS ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Mais {open.length - MAX_TASKS} abertas ·{" "}
                <Link href={`/tarefas?owner=${subject.id}`} className="hover:underline">
                  ver todas
                </Link>
              </p>
            ) : null}
            {doneRecent.length > 0 ? (
              <div className="mt-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Concluídas recentemente</h3>
                <ul className="flex flex-col gap-0.5 text-sm">
                  {doneRecent.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-muted-foreground">
                      <span className="min-w-0 truncate line-through decoration-muted-foreground/50">{t.title}</span>
                      {t.href ? (
                        <Link href={t.href} className="hidden max-w-[40%] shrink-0 truncate text-xs hover:underline sm:inline">
                          {t.entityLabel}
                        </Link>
                      ) : (
                        <span className="hidden max-w-[40%] shrink-0 truncate text-xs sm:inline">{t.entityLabel}</span>
                      )}
                      <span className="ml-auto shrink-0 text-xs">{t.completedAt ? formatDate(t.completedAt.toISOString().slice(0, 10)) : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">{isSelf ? "Os meus processos" : `Processos de ${first}`}</h2>
            <ProcessesList rows={owned} today={today} empty={isSelf ? "Não é responsável por nenhum negócio, obra ou venda em aberto." : `${first} não é responsável por nenhum processo em aberto.`} />
            {withMyTasks.length > 0 ? (
              <div className="mt-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isSelf ? "Outros processos com tarefas minhas" : "Outros processos com tarefas atribuídas"}</h3>
                <ul className="divide-y rounded-lg border bg-card">
                  {withMyTasks.map((g) => (
                    <li key={g.key} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                      {g.href ? (
                        <Link href={g.href} className="min-w-0 truncate font-medium hover:underline">
                          {g.label}
                        </Link>
                      ) : (
                        <span className="min-w-0 truncate text-muted-foreground">{g.label}</span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {g.count} {g.count === 1 ? "tarefa" : "tarefas"}
                        {g.next ? ` · ${g.next}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <AttentionPanel stats={attentionStats} withoutTask={withoutTask} unassigned={unassigned} blocked={blocked} overdue={overdue} owner={isSelf ? undefined : subject.id} />
          {indicators.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Indicadores</h2>
              <ModuleIndicatorsGrid groups={indicators} />
            </section>
          ) : null}
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Atividade recente</h2>
        <ActivityFeed rows={activity} lookups={lookups} />
      </section>

      {funnel && forecast ? (
        <>
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">Funil comercial</h2>
            <FunnelTable rows={funnel} historyHref="/funil" />
          </section>
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">Previsão de compras</h2>
            <ForecastPanel f={forecast} />
          </section>
        </>
      ) : null}
    </>
  );
}

/** Agrupa tarefas abertas por registo: nome, link, n.º de tarefas e título da mais próxima. */
function groupByEntity(rows: TaskListRow[]) {
  const map = new Map<string, { key: string; label: string; href: string; count: number; next: string | null }>();
  for (const t of rows) {
    const key = `${t.entityType}:${t.entityId}`;
    const g = map.get(key);
    if (g) g.count += 1;
    else map.set(key, { key, label: t.entityLabel, href: t.href, count: 1, next: t.title });
  }
  return [...map.values()];
}
