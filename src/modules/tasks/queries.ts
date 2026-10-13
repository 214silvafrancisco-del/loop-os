import "server-only";
import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { deals } from "@/modules/deals/schema";
import { projects } from "@/modules/projects/schema";
import { properties } from "@/modules/properties/schema";
import { saleLeads, sales } from "@/modules/sales/schema";
import { taskAlert, type TaskAlert } from "./alerts";
import { tasks, type Task, type TaskEntity, type TaskStatus } from "./schema";

/** Próxima tarefa de um registo, para cabeçalhos, cartões e listas. */
export type NextTask = {
  id: string;
  title: string;
  dueDate: string | null;
  status: TaskStatus;
  assigneeUserId: string | null;
  assigneeName: string | null;
  /** Tarefas abertas no registo (incluindo esta). */
  openCount: number;
};

/** Ordem da «próxima»: prazo mais próximo primeiro, sem prazo no fim, depois a mais antiga. */
const nextOrder = [sql`${tasks.dueDate} asc nulls last`, asc(tasks.createdAt)];

/** Próxima tarefa aberta de vários registos do mesmo tipo, num só pedido. */
export async function getNextTasksMap(organizationId: string, entityType: TaskEntity, entityIds: string[]): Promise<Map<string, NextTask>> {
  const map = new Map<string, NextTask>();
  if (entityIds.length === 0) return map;
  const rows = await db
    .select({
      id: tasks.id,
      entityId: tasks.entityId,
      title: tasks.title,
      dueDate: tasks.dueDate,
      status: tasks.status,
      assigneeUserId: tasks.assigneeUserId,
      assigneeName: profiles.fullName,
    })
    .from(tasks)
    .leftJoin(profiles, eq(tasks.assigneeUserId, profiles.id))
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.entityType, entityType), inArray(tasks.entityId, entityIds), ne(tasks.status, "concluida")))
    .orderBy(asc(tasks.entityId), ...nextOrder);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.entityId, (counts.get(r.entityId) ?? 0) + 1);
  for (const r of rows) {
    if (!map.has(r.entityId)) map.set(r.entityId, { id: r.id, title: r.title, dueDate: r.dueDate, status: r.status, assigneeUserId: r.assigneeUserId, assigneeName: r.assigneeName, openCount: 0 });
  }
  for (const [id, t] of map) t.openCount = counts.get(id) ?? 0;
  return map;
}

export async function getNextTask(organizationId: string, entityType: TaskEntity, entityId: string): Promise<NextTask | null> {
  return (await getNextTasksMap(organizationId, entityType, [entityId])).get(entityId) ?? null;
}

export type TaskRow = Task & { assigneeName: string | null; completedByName: string | null };

/** Histórico de tarefas de um registo: abertas primeiro (por prazo), depois concluídas (mais recentes primeiro). */
export async function listTasksForEntity(organizationId: string, entityType: TaskEntity, entityId: string): Promise<TaskRow[]> {
  const done = db.$with("done").as(db.select({ id: profiles.id, name: profiles.fullName }).from(profiles));
  const rows = await db
    .with(done)
    .select({ task: tasks, assigneeName: profiles.fullName, completedByName: done.name })
    .from(tasks)
    .leftJoin(profiles, eq(tasks.assigneeUserId, profiles.id))
    .leftJoin(done, eq(tasks.completedBy, done.id))
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.entityType, entityType), eq(tasks.entityId, entityId)))
    .orderBy(sql`case ${tasks.status} when 'concluida' then 1 else 0 end`, sql`${tasks.dueDate} asc nulls last`, desc(tasks.completedAt), asc(tasks.createdAt));
  return rows.map((r) => ({ ...r.task, assigneeName: r.assigneeName, completedByName: r.completedByName }));
}

export type TaskListFilters = {
  assigneeUserId?: string;
  entityType?: TaskEntity;
  status?: TaskStatus | "abertas";
  dueUntil?: string;
  overdueOnly?: boolean;
  /** Restringe aos tipos de registo a que o utilizador tem acesso (Fase 3). */
  allowedEntityTypes?: TaskEntity[];
  /** Com `allowedEntityTypes`: inclui também as tarefas atribuídas a este utilizador noutros módulos, sem expor o registo. */
  viewerUserId?: string;
  limit?: number;
};

export type TaskListRow = TaskRow & {
  alert: TaskAlert;
  /** Para onde a tarefa leva: ficha do registo. */
  href: string;
  /** "LH-0007 · T2 Alvalade", "Obra T2 Benfica", "Venda LH-0003", "Lead João (LH-0003)". */
  entityLabel: string;
  propertyRef: string | null;
};

/** Lista de tarefas com filtros e o rótulo do registo. */
export async function listTasks(organizationId: string, filters: TaskListFilters, today: string): Promise<TaskListRow[]> {
  const conditions = [eq(tasks.organizationId, organizationId)];
  if (filters.assigneeUserId === "none") conditions.push(isNull(tasks.assigneeUserId));
  else if (filters.assigneeUserId) conditions.push(eq(tasks.assigneeUserId, filters.assigneeUserId));
  if (filters.entityType) conditions.push(eq(tasks.entityType, filters.entityType));
  if (filters.allowedEntityTypes) {
    const allowed = filters.allowedEntityTypes.length ? inArray(tasks.entityType, filters.allowedEntityTypes) : sql`false`;
    conditions.push(filters.viewerUserId ? or(allowed, eq(tasks.assigneeUserId, filters.viewerUserId))! : allowed);
  }
  if (filters.status === "abertas" || !filters.status) conditions.push(ne(tasks.status, "concluida"));
  else conditions.push(eq(tasks.status, filters.status));
  if (filters.dueUntil) conditions.push(lte(tasks.dueDate, filters.dueUntil));
  if (filters.overdueOnly) conditions.push(and(ne(tasks.status, "concluida"), sql`${tasks.dueDate} < ${today}`)!);

  const rows = await db
    .select({ task: tasks, assigneeName: profiles.fullName })
    .from(tasks)
    .leftJoin(profiles, eq(tasks.assigneeUserId, profiles.id))
    .where(and(...conditions))
    .orderBy(sql`case ${tasks.status} when 'concluida' then 1 else 0 end`, sql`${tasks.dueDate} asc nulls last`, desc(tasks.completedAt), asc(tasks.createdAt))
    .limit(filters.limit ?? 300);
  const labels = await entityLabels(organizationId, rows.map((r) => ({ entityType: r.task.entityType, entityId: r.task.entityId })));
  const allowedSet = filters.allowedEntityTypes ? new Set<string>(filters.allowedEntityTypes) : null;
  return rows.map((r) => {
    const l = labels.get(`${r.task.entityType}:${r.task.entityId}`) ?? { label: "(registo apagado)", href: "/dashboard", ref: null };
    // Tarefa de um módulo sem acesso: só o título; sem link nem identificação do registo.
    const masked = allowedSet !== null && !allowedSet.has(r.task.entityType);
    return { ...r.task, assigneeName: r.assigneeName, completedByName: null, alert: taskAlert(r.task, today), href: masked ? "" : l.href, entityLabel: masked ? "(módulo sem acesso)" : l.label, propertyRef: masked ? null : l.ref };
  });
}

/** Rótulos e links dos registos das tarefas (um pedido por tipo). */
async function entityLabels(organizationId: string, refs: { entityType: TaskEntity; entityId: string }[]) {
  const map = new Map<string, { label: string; href: string; ref: string | null }>();
  const ids = (t: TaskEntity) => [...new Set(refs.filter((r) => r.entityType === t).map((r) => r.entityId))];
  const dealIds = ids("deal");
  const projectIds = ids("project");
  const saleIds = ids("sale");
  const leadIds = ids("sale_lead");
  const [d, p, s, l] = await Promise.all([
    dealIds.length
      ? db
          .select({ id: deals.id, name: deals.name, seq: deals.seq, ref: properties.ref, addressLine: properties.addressLine })
          .from(deals)
          .innerJoin(properties, eq(deals.propertyId, properties.id))
          .where(and(eq(deals.organizationId, organizationId), inArray(deals.id, dealIds)))
      : [],
    projectIds.length
      ? db
          .select({ id: projects.id, name: projects.name, ref: properties.ref })
          .from(projects)
          .innerJoin(properties, eq(projects.propertyId, properties.id))
          .where(and(eq(projects.organizationId, organizationId), inArray(projects.id, projectIds)))
      : [],
    saleIds.length
      ? db
          .select({ id: sales.id, ref: properties.ref, addressLine: properties.addressLine, dealName: deals.name })
          .from(sales)
          .innerJoin(properties, eq(sales.propertyId, properties.id))
          .leftJoin(deals, eq(sales.dealId, deals.id))
          .where(and(eq(sales.organizationId, organizationId), inArray(sales.id, saleIds)))
      : [],
    leadIds.length
      ? db
          .select({ id: saleLeads.id, name: saleLeads.name, saleId: saleLeads.saleId, ref: properties.ref })
          .from(saleLeads)
          .innerJoin(properties, eq(saleLeads.propertyId, properties.id))
          .where(and(eq(saleLeads.organizationId, organizationId), inArray(saleLeads.id, leadIds)))
      : [],
  ]);
  for (const x of d) map.set(`deal:${x.id}`, { label: `${x.seq > 1 ? `${x.ref}·${x.seq}` : x.ref} · ${x.name ?? x.addressLine}`, href: `/deals/${x.id}`, ref: x.ref });
  for (const x of p) map.set(`project:${x.id}`, { label: `Obra ${x.name}`, href: `/projects/${x.id}`, ref: x.ref });
  for (const x of s) map.set(`sale:${x.id}`, { label: `Venda ${x.ref} · ${x.dealName ?? x.addressLine}`, href: `/sales/${x.id}`, ref: x.ref });
  for (const x of l) map.set(`sale_lead:${x.id}`, { label: `Lead ${x.name} (${x.ref})`, href: `/sales/${x.saleId}/leads`, ref: x.ref });
  return map;
}

/** Tarefas abertas com prazo até `until` (inclui atrasadas): dashboard e resumo diário. */
export async function listDueTasks(organizationId: string, until: string, today: string, opts: { assigneeUserId?: string; allowedEntityTypes?: TaskEntity[]; viewerUserId?: string; limit?: number } = {}): Promise<TaskListRow[]> {
  return listTasks(organizationId, { status: "abertas", dueUntil: until, assigneeUserId: opts.assigneeUserId, allowedEntityTypes: opts.allowedEntityTypes, viewerUserId: opts.viewerUserId, limit: opts.limit ?? 50 }, today);
}

/** Contagens para alertas: abertas, atrasadas, sem responsável, bloqueadas. */
export async function countTaskAlerts(organizationId: string, today: string, assigneeUserId?: string): Promise<{ open: number; overdue: number; unassigned: number; blocked: number; soon: number }> {
  const scope = [eq(tasks.organizationId, organizationId), ne(tasks.status, "concluida"), ...(assigneeUserId ? [eq(tasks.assigneeUserId, assigneeUserId)] : [])];
  const soonEnd = new Date(today + "T00:00:00Z");
  soonEnd.setUTCDate(soonEnd.getUTCDate() + 7);
  const soon = soonEnd.toISOString().slice(0, 10);
  const [r] = await db
    .select({
      open: sql<number>`count(*)::int`,
      overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < ${today} and ${tasks.status} <> 'bloqueada')::int`,
      unassigned: sql<number>`count(*) filter (where ${tasks.assigneeUserId} is null)::int`,
      blocked: sql<number>`count(*) filter (where ${tasks.status} = 'bloqueada')::int`,
      soon: sql<number>`count(*) filter (where ${tasks.dueDate} >= ${today} and ${tasks.dueDate} <= ${soon})::int`,
    })
    .from(tasks)
    .where(and(...scope));
  return r ?? { open: 0, overdue: 0, unassigned: 0, blocked: 0, soon: 0 };
}

/** Negócios ativos (fora de Compra) sem tarefa aberta. */
export async function countDealsWithoutOpenTask(organizationId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(deals)
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.status, "active"),
        isNull(deals.deletedAt),
        sql`not exists (select 1 from tasks t where t.entity_type = 'deal' and t.entity_id = ${deals.id} and t.status <> 'concluida')`,
        or(sql`(select s.is_purchase from deal_stages s where s.id = ${deals.stageId}) = false`, sql`false`)!,
      ),
    );
  return r?.n ?? 0;
}
