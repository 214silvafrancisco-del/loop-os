import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { addDaysIso, SOON_DAYS } from "@/modules/tasks/alerts";
import { tasks, type TaskEntity } from "@/modules/tasks/schema";

/* ------------------------------------------------------------------ */
/* Contagens de tarefas                                                 */
/* ------------------------------------------------------------------ */

export type TaskStats = {
  open: number;
  porIniciar: number;
  emCurso: number;
  /** Prazo passado (exclui bloqueadas, que têm o seu próprio sinal). */
  overdue: number;
  /** Prazo entre hoje e os próximos 7 dias. */
  soon: number;
  blocked: number;
  unassigned: number;
  /** Concluídas nos últimos 7 dias. */
  doneRecent: number;
};

const EMPTY_STATS: TaskStats = {
  open: 0,
  porIniciar: 0,
  emCurso: 0,
  overdue: 0,
  soon: 0,
  blocked: 0,
  unassigned: 0,
  doneRecent: 0,
};

/** Contagens calculadas a partir das tarefas reais, por responsável e/ou por tipos de registo acessíveis. */
export async function getTaskStats(
  organizationId: string,
  today: string,
  opts: { assigneeUserId?: string | "none"; entityTypes?: TaskEntity[] } = {},
): Promise<TaskStats> {
  if (opts.entityTypes && opts.entityTypes.length === 0) return EMPTY_STATS;
  const scope = [eq(tasks.organizationId, organizationId)];
  if (opts.assigneeUserId === "none") scope.push(isNull(tasks.assigneeUserId));
  else if (opts.assigneeUserId)
    scope.push(eq(tasks.assigneeUserId, opts.assigneeUserId));
  if (opts.entityTypes) scope.push(inArray(tasks.entityType, opts.entityTypes));
  const soonEnd = addDaysIso(today, SOON_DAYS);
  const recentStart = addDaysIso(today, -7);
  const open = sql`${tasks.status} <> 'concluida'`;
  const [r] = await db
    .select({
      open: sql<number>`count(*) filter (where ${open})::int`,
      porIniciar: sql<number>`count(*) filter (where ${tasks.status} = 'por_iniciar')::int`,
      emCurso: sql<number>`count(*) filter (where ${tasks.status} = 'em_curso')::int`,
      overdue: sql<number>`count(*) filter (where ${open} and ${tasks.status} <> 'bloqueada' and ${tasks.dueDate} < ${today})::int`,
      soon: sql<number>`count(*) filter (where ${open} and ${tasks.dueDate} >= ${today} and ${tasks.dueDate} <= ${soonEnd})::int`,
      blocked: sql<number>`count(*) filter (where ${tasks.status} = 'bloqueada')::int`,
      unassigned: sql<number>`count(*) filter (where ${open} and ${tasks.assigneeUserId} is null)::int`,
      doneRecent: sql<number>`count(*) filter (where ${tasks.status} = 'concluida' and ${tasks.completedAt} >= ${recentStart}::date)::int`,
    })
    .from(tasks)
    .where(and(...scope));
  return r ?? EMPTY_STATS;
}
