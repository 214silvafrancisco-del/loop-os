import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { AuditRow } from "@/core/audit/queries";
import { allowedTaskEntities, type Accessor, type AppModule, hasModule, moduleForEntity } from "@/core/auth/access";
import { db } from "@/core/db/client";
import { auditLog } from "@/core/db/schema/audit";
import { profiles } from "@/core/db/schema/core";
import { deals } from "@/modules/deals/schema";
import { projects } from "@/modules/projects/schema";
import { PROJECT_STATUS_LABEL } from "@/modules/projects/validation";
import { properties } from "@/modules/properties/schema";
import { SALE_STAGE_LABEL } from "@/modules/sales/constants";
import { sales } from "@/modules/sales/schema";
import { dealStages } from "@/modules/settings/schema";
import { addDaysIso, SOON_DAYS } from "@/modules/tasks/alerts";
import { getEntityLabels, getNextTasksMap, type NextTask } from "@/modules/tasks/queries";
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

const EMPTY_STATS: TaskStats = { open: 0, porIniciar: 0, emCurso: 0, overdue: 0, soon: 0, blocked: 0, unassigned: 0, doneRecent: 0 };

/** Contagens calculadas a partir das tarefas reais, por responsável e/ou por tipos de registo acessíveis. */
export async function getTaskStats(organizationId: string, today: string, opts: { assigneeUserId?: string | "none"; entityTypes?: TaskEntity[] } = {}): Promise<TaskStats> {
  if (opts.entityTypes && opts.entityTypes.length === 0) return EMPTY_STATS;
  const scope = [eq(tasks.organizationId, organizationId)];
  if (opts.assigneeUserId === "none") scope.push(isNull(tasks.assigneeUserId));
  else if (opts.assigneeUserId) scope.push(eq(tasks.assigneeUserId, opts.assigneeUserId));
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

/* ------------------------------------------------------------------ */
/* Processos (negócios, obras, vendas)                                  */
/* ------------------------------------------------------------------ */

export type ProcessKind = "deal" | "project" | "sale";
export const PROCESS_KIND_LABEL: Record<ProcessKind, string> = { deal: "Negócio", project: "Obra", sale: "Venda" };

export type ProcessRow = {
  kind: ProcessKind;
  id: string;
  href: string;
  /** "LH-0007 · T2 Alvalade" */
  label: string;
  ref: string;
  stateLabel: string;
  /** Responsável global pelo processo (distinto do responsável pela próxima tarefa). */
  ownerName: string | null;
  nextTask: NextTask | null;
};

const OPEN_PROJECT_STATUSES = ["planeamento", "a_iniciar", "em_curso", "pausada"] as const;
const OPEN_SALE_STAGES = ["preparacao", "a_venda", "cpcv"] as const;

type ProcessFilter = { ownerUserId?: string; withoutOpenTask?: boolean; limit?: number };

const noOpenTask = (entityType: ProcessKind, idCol: unknown) => sql`not exists (select 1 from tasks t where t.entity_type = ${entityType} and t.entity_id = ${idCol} and t.status <> 'concluida')`;

async function listDealProcesses(organizationId: string, f: ProcessFilter): Promise<ProcessRow[]> {
  const conditions = [eq(deals.organizationId, organizationId), isNull(deals.deletedAt), eq(deals.status, "active"), eq(dealStages.isPurchase, false)];
  if (f.ownerUserId) conditions.push(eq(deals.ownerUserId, f.ownerUserId));
  if (f.withoutOpenTask) conditions.push(noOpenTask("deal", deals.id));
  const rows = await db
    .select({ id: deals.id, name: deals.name, seq: deals.seq, ref: properties.ref, addressLine: properties.addressLine, stageName: dealStages.name, ownerName: profiles.fullName })
    .from(deals)
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .innerJoin(dealStages, eq(deals.stageId, dealStages.id))
    .leftJoin(profiles, eq(deals.ownerUserId, profiles.id))
    .where(and(...conditions))
    .orderBy(asc(dealStages.sort), asc(properties.ref))
    .limit(f.limit ?? 100);
  return rows.map((x) => ({ kind: "deal", id: x.id, href: `/deals/${x.id}`, label: `${x.seq > 1 ? `${x.ref}·${x.seq}` : x.ref} · ${x.name ?? x.addressLine}`, ref: x.ref, stateLabel: x.stageName, ownerName: x.ownerName, nextTask: null }));
}

async function listProjectProcesses(organizationId: string, f: ProcessFilter): Promise<ProcessRow[]> {
  const conditions = [eq(projects.organizationId, organizationId), isNull(projects.deletedAt), inArray(projects.status, [...OPEN_PROJECT_STATUSES])];
  if (f.ownerUserId) conditions.push(eq(projects.managerUserId, f.ownerUserId));
  if (f.withoutOpenTask) conditions.push(noOpenTask("project", projects.id));
  const rows = await db
    .select({ id: projects.id, name: projects.name, status: projects.status, ref: properties.ref, ownerName: profiles.fullName })
    .from(projects)
    .innerJoin(properties, eq(projects.propertyId, properties.id))
    .leftJoin(profiles, eq(projects.managerUserId, profiles.id))
    .where(and(...conditions))
    .orderBy(asc(properties.ref))
    .limit(f.limit ?? 100);
  return rows.map((x) => ({ kind: "project", id: x.id, href: `/projects/${x.id}`, label: `Obra ${x.name}`, ref: x.ref, stateLabel: PROJECT_STATUS_LABEL[x.status], ownerName: x.ownerName, nextTask: null }));
}

async function listSaleProcesses(organizationId: string, f: ProcessFilter): Promise<ProcessRow[]> {
  const conditions = [eq(sales.organizationId, organizationId), isNull(sales.deletedAt), inArray(sales.stage, [...OPEN_SALE_STAGES])];
  if (f.ownerUserId) conditions.push(eq(sales.ownerUserId, f.ownerUserId));
  if (f.withoutOpenTask) conditions.push(noOpenTask("sale", sales.id));
  const rows = await db
    .select({ id: sales.id, stage: sales.stage, ref: properties.ref, addressLine: properties.addressLine, dealName: deals.name, ownerName: profiles.fullName })
    .from(sales)
    .innerJoin(properties, eq(sales.propertyId, properties.id))
    .leftJoin(deals, eq(sales.dealId, deals.id))
    .leftJoin(profiles, eq(sales.ownerUserId, profiles.id))
    .where(and(...conditions))
    .orderBy(asc(properties.ref))
    .limit(f.limit ?? 100);
  return rows.map((x) => ({ kind: "sale", id: x.id, href: `/sales/${x.id}`, label: `Venda ${x.ref} · ${x.dealName ?? x.addressLine}`, ref: x.ref, stateLabel: SALE_STAGE_LABEL[x.stage], ownerName: x.ownerName, nextTask: null }));
}

/** Junta a próxima tarefa aberta a cada processo (um pedido por tipo). */
async function withNextTask(organizationId: string, rows: ProcessRow[]): Promise<ProcessRow[]> {
  const kinds: ProcessKind[] = ["deal", "project", "sale"];
  const maps = await Promise.all(kinds.map((k) => getNextTasksMap(organizationId, k, rows.filter((r) => r.kind === k).map((r) => r.id))));
  const byKind = new Map(kinds.map((k, i) => [k, maps[i]!]));
  return rows.map((r) => ({ ...r, nextTask: byKind.get(r.kind)?.get(r.id) ?? null }));
}

/** Processos em aberto pelos quais o utilizador é responsável global, nos módulos acessíveis ao visualizador. */
export async function listOwnedProcesses(organizationId: string, ownerUserId: string, viewer: Accessor): Promise<ProcessRow[]> {
  const parts = await Promise.all([
    hasModule(viewer, "negocios") ? listDealProcesses(organizationId, { ownerUserId }) : [],
    hasModule(viewer, "obras") ? listProjectProcesses(organizationId, { ownerUserId }) : [],
    hasModule(viewer, "vendas") ? listSaleProcesses(organizationId, { ownerUserId }) : [],
  ]);
  return withNextTask(organizationId, parts.flat());
}

/** Processos em aberto sem nenhuma tarefa aberta (falta de seguimento), nos módulos acessíveis. */
export async function listProcessesWithoutTask(organizationId: string, viewer: Accessor, limitPerKind = 8): Promise<ProcessRow[]> {
  const parts = await Promise.all([
    hasModule(viewer, "negocios") ? listDealProcesses(organizationId, { withoutOpenTask: true, limit: limitPerKind }) : [],
    hasModule(viewer, "obras") ? listProjectProcesses(organizationId, { withoutOpenTask: true, limit: limitPerKind }) : [],
    hasModule(viewer, "vendas") ? listSaleProcesses(organizationId, { withoutOpenTask: true, limit: limitPerKind }) : [],
  ]);
  return parts.flat();
}

/* ------------------------------------------------------------------ */
/* Carga de trabalho por pessoa (Founder)                               */
/* ------------------------------------------------------------------ */

export type WorkloadRow = {
  userId: string | null;
  name: string;
  isActive: boolean;
  open: number;
  overdue: number;
  soon: number;
  blocked: number;
  doneRecent: number;
  /** Negócios + obras + vendas em aberto de que é responsável global. */
  owned: number;
};

/** Carga por colaborador, calculada a partir das tarefas e dos processos reais; termina com a linha «Sem responsável». */
export async function listWorkload(organizationId: string, today: string): Promise<WorkloadRow[]> {
  const soonEnd = addDaysIso(today, SOON_DAYS);
  const recentStart = addDaysIso(today, -7);
  const open = sql`${tasks.status} <> 'concluida'`;
  const rows = await db
    .select({
      userId: profiles.id,
      name: profiles.fullName,
      isActive: profiles.isActive,
      open: sql<number>`count(${tasks.id}) filter (where ${open})::int`,
      overdue: sql<number>`count(${tasks.id}) filter (where ${open} and ${tasks.status} <> 'bloqueada' and ${tasks.dueDate} < ${today})::int`,
      soon: sql<number>`count(${tasks.id}) filter (where ${open} and ${tasks.dueDate} >= ${today} and ${tasks.dueDate} <= ${soonEnd})::int`,
      blocked: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'bloqueada')::int`,
      doneRecent: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'concluida' and ${tasks.completedAt} >= ${recentStart}::date)::int`,
      owned: sql<number>`(select count(*)::int from deals d join deal_stages s on s.id = d.stage_id where d.organization_id = ${organizationId} and d.owner_user_id = ${profiles.id} and d.status = 'active' and d.deleted_at is null and s.is_purchase = false)
        + (select count(*)::int from projects p where p.organization_id = ${organizationId} and p.manager_user_id = ${profiles.id} and p.deleted_at is null and p.status in ('planeamento','a_iniciar','em_curso','pausada'))
        + (select count(*)::int from sales v where v.organization_id = ${organizationId} and v.owner_user_id = ${profiles.id} and v.deleted_at is null and v.stage in ('preparacao','a_venda','cpcv'))`,
    })
    .from(profiles)
    .leftJoin(tasks, and(eq(tasks.assigneeUserId, profiles.id), eq(tasks.organizationId, organizationId)))
    .where(eq(profiles.organizationId, organizationId))
    .groupBy(profiles.id)
    .orderBy(desc(profiles.isActive), asc(profiles.fullName));
  const unassigned = await getTaskStats(organizationId, today, { assigneeUserId: "none" });
  const people = rows.filter((r) => r.isActive || r.open > 0);
  return [...people, { userId: null, name: "Sem responsável", isActive: true, open: unassigned.open, overdue: unassigned.overdue, soon: unassigned.soon, blocked: unassigned.blocked, doneRecent: 0, owned: 0 }];
}

/* ------------------------------------------------------------------ */
/* Indicadores por módulo                                               */
/* ------------------------------------------------------------------ */

export type Indicator = { label: string; value: number; href: string; tone?: "warn" | "bad" };
export type ModuleIndicators = { module: AppModule; label: string; href: string; items: Indicator[] };

/** Indicadores operacionais, calculados a partir dos registos, só para os módulos acessíveis. */
export async function getModuleIndicators(organizationId: string, viewer: Accessor, today: string): Promise<ModuleIndicators[]> {
  const soonEnd = addDaysIso(today, SOON_DAYS);
  const out: ModuleIndicators[] = [];
  const openTask = (entityType: string) => sql<number>`(select count(*)::int from tasks t where t.organization_id = ${organizationId} and t.entity_type = ${entityType} and t.status <> 'concluida')`;
  const dueTask = (entityType: string) => sql<number>`(select count(*)::int from tasks t where t.organization_id = ${organizationId} and t.entity_type = ${entityType} and t.status <> 'concluida' and t.due_date <= ${soonEnd})`;

  if (hasModule(viewer, "negocios")) {
    const [r] = await db
      .select({
        active: sql<number>`count(*)::int`,
        withoutTask: sql<number>`count(*) filter (where ${noOpenTask("deal", deals.id)})::int`,
        due: dueTask("deal"),
      })
      .from(deals)
      .innerJoin(dealStages, eq(deals.stageId, dealStages.id))
      .where(and(eq(deals.organizationId, organizationId), isNull(deals.deletedAt), eq(deals.status, "active"), eq(dealStages.isPurchase, false)));
    out.push({
      module: "negocios",
      label: "Negócios",
      href: "/deals",
      items: [
        { label: "Oportunidades em curso", value: r?.active ?? 0, href: "/deals" },
        { label: "Tarefas até 7 dias", value: r?.due ?? 0, href: `/tarefas?module=deal&until=${soonEnd}` },
        { label: "Sem seguimento", value: r?.withoutTask ?? 0, href: "/deals", tone: r?.withoutTask ? "warn" : undefined },
      ],
    });
  }
  if (hasModule(viewer, "obras")) {
    const [r] = await db
      .select({
        active: sql<number>`count(*) filter (where ${projects.status} = 'em_curso')::int`,
        openTasks: openTask("project"),
        overdueInvoices: sql<number>`(select count(*)::int from invoices i where i.organization_id = ${organizationId} and i.deleted_at is null and i.due_date < ${today} and i.total > coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0))`,
      })
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), isNull(projects.deletedAt)));
    out.push({
      module: "obras",
      label: "Obras",
      href: "/projects",
      items: [
        { label: "Obras em curso", value: r?.active ?? 0, href: "/projects?status=em_curso" },
        { label: "Tarefas pendentes", value: r?.openTasks ?? 0, href: "/tarefas?module=project" },
        { label: "Faturas vencidas", value: r?.overdueInvoices ?? 0, href: "/projects", tone: r?.overdueInvoices ? "bad" : undefined },
      ],
    });
  }
  if (hasModule(viewer, "vendas")) {
    const [r] = await db
      .select({
        open: sql<number>`count(*)::int`,
        withoutTask: sql<number>`count(*) filter (where ${noOpenTask("sale", sales.id)})::int`,
        openLeads: sql<number>`(select count(*)::int from sale_leads l join sales v on v.id = l.sale_id where l.organization_id = ${organizationId} and v.deleted_at is null and l.status not in ('ganho','perdido'))`,
        leadsWithoutTask: sql<number>`(select count(*)::int from sale_leads l join sales v on v.id = l.sale_id where l.organization_id = ${organizationId} and v.deleted_at is null and l.status not in ('ganho','perdido') and not exists (select 1 from tasks t where t.entity_type = 'sale_lead' and t.entity_id = l.id and t.status <> 'concluida'))`,
      })
      .from(sales)
      .where(and(eq(sales.organizationId, organizationId), isNull(sales.deletedAt), inArray(sales.stage, [...OPEN_SALE_STAGES])));
    const pending = (r?.withoutTask ?? 0) + (r?.leadsWithoutTask ?? 0);
    out.push({
      module: "vendas",
      label: "Vendas",
      href: "/sales",
      items: [
        { label: "Vendas em curso", value: r?.open ?? 0, href: "/sales" },
        { label: "Leads em aberto", value: r?.openLeads ?? 0, href: "/sales" },
        { label: "Sem seguimento", value: pending, href: "/sales", tone: pending ? "warn" : undefined },
      ],
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Atividade recente                                                    */
/* ------------------------------------------------------------------ */

export type ActivityRow = AuditRow & {
  /** Ficha do registo a que a entrada diz respeito; vazio quando o módulo não é acessível. */
  href: string;
  entityLabel: string;
  module: AppModule;
};

const ACTIVITY_TABLES = ["tasks", "deals", "projects", "sales", "sale_leads"] as const;
const RELEVANT_FIELDS = ["status", "stage", "stage_id", "assignee_user_id", "due_date", "title", "owner_user_id", "manager_user_id", "deed_date", "cpcv_date"];
const TABLE_MODULE: Record<(typeof ACTIVITY_TABLES)[number], AppModule | null> = { tasks: null, deals: "negocios", projects: "obras", sales: "vendas", sale_leads: "vendas" };

function activityModule(e: AuditRow): AppModule {
  if (e.tableName === "tasks") {
    const d = (e.newData ?? e.oldData ?? {}) as Record<string, unknown>;
    return moduleForEntity(String(d.entity_type ?? "deal"));
  }
  return TABLE_MODULE[e.tableName as (typeof ACTIVITY_TABLES)[number]] ?? "negocios";
}

/**
 * Entradas recentes da auditoria relevantes para o dashboard: tarefas (criadas, concluídas,
 * mudança de prazo/responsável/estado) e mudanças de fase/estado dos processos.
 * - `forUserId`: feed pessoal — tarefas em que o utilizador é ou foi responsável (ou que ele tocou)
 *   e mudanças nos processos dos módulos acessíveis.
 * - `aboutUserId` (Founder): só o que esse colaborador fez ou lhe foi atribuído.
 */
export async function listRecentActivity(organizationId: string, viewer: Accessor, opts: { forUserId?: string; aboutUserId?: string; limit?: number } = {}): Promise<ActivityRow[]> {
  const nd = (k: string) => sql`${auditLog.newData} ->> ${k}`;
  const od = (k: string) => sql`${auditLog.oldData} ->> ${k}`;
  const taskEntities = allowedTaskEntities(viewer);
  const accessibleTables = (ACTIVITY_TABLES as readonly string[]).filter((t) => t !== "tasks" && hasModule(viewer, TABLE_MODULE[t as keyof typeof TABLE_MODULE]!));
  const taskOfAllowed = taskEntities.length ? and(eq(auditLog.tableName, "tasks"), inArray(sql`coalesce(${nd("entity_type")}, ${od("entity_type")})`, taskEntities))! : sql`false`;
  const involves = (u: string) => or(eq(auditLog.userId, u), eq(nd("assignee_user_id"), u), eq(od("assignee_user_id"), u))!;

  const scopeParts = [];
  if (opts.forUserId) {
    // Tarefas em que o próprio está envolvido (mesmo noutros módulos: ficam sem link) + processos acessíveis.
    scopeParts.push(and(eq(auditLog.tableName, "tasks"), involves(opts.forUserId))!);
    if (accessibleTables.length) scopeParts.push(inArray(auditLog.tableName, accessibleTables));
  } else {
    scopeParts.push(taskOfAllowed);
    if (accessibleTables.length) scopeParts.push(inArray(auditLog.tableName, accessibleTables));
  }
  const conditions = [
    eq(auditLog.organizationId, organizationId),
    inArray(auditLog.tableName, [...ACTIVITY_TABLES]),
    or(...scopeParts)!,
    or(ne(auditLog.action, "update"), sql`${auditLog.changedFields} && array[${sql.join(RELEVANT_FIELDS.map((f) => sql`${f}`), sql`, `)}]::text[]`)!,
  ];
  if (opts.aboutUserId) conditions.push(involves(opts.aboutUserId));

  const rows = await db
    .select({
      id: auditLog.id,
      organizationId: auditLog.organizationId,
      tableName: auditLog.tableName,
      rowId: auditLog.rowId,
      propertyId: auditLog.propertyId,
      action: auditLog.action,
      changedFields: auditLog.changedFields,
      oldData: auditLog.oldData,
      newData: auditLog.newData,
      userId: auditLog.userId,
      at: auditLog.at,
      userName: profiles.fullName,
    })
    .from(auditLog)
    .leftJoin(profiles, eq(auditLog.userId, profiles.id))
    .where(and(...conditions))
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(opts.limit ?? 20);

  // Rótulo e link do registo: tarefas apontam para o registo-pai; processos para a própria ficha.
  const refs = rows.map((e) => {
    if (e.tableName === "tasks") {
      const d = (e.newData ?? e.oldData ?? {}) as Record<string, unknown>;
      return { entityType: String(d.entity_type ?? "deal") as TaskEntity, entityId: String(d.entity_id ?? e.rowId) };
    }
    const type = ({ deals: "deal", projects: "project", sales: "sale", sale_leads: "sale_lead" } as Record<string, TaskEntity>)[e.tableName] ?? "deal";
    return { entityType: type, entityId: e.rowId };
  });
  const labels = await getEntityLabels(organizationId, refs);
  return rows.map((e, i) => {
    const mod = activityModule(e);
    const ref = refs[i]!;
    const l = labels.get(`${ref.entityType}:${ref.entityId}`);
    const masked = !hasModule(viewer, mod);
    return { ...e, module: mod, href: masked || !l ? "" : l.href, entityLabel: masked ? "(módulo sem acesso)" : (l?.label ?? "(registo apagado)") };
  });
}

/** Nomes de todos os utilizadores (ativos ou não) para traduzir ids no histórico. */
export async function listUserNames(organizationId: string): Promise<Record<string, string>> {
  const rows = await db.select({ id: profiles.id, name: profiles.fullName }).from(profiles).where(eq(profiles.organizationId, organizationId));
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
