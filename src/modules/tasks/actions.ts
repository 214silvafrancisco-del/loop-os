"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasModule, moduleForEntity } from "@/core/auth/access";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { dbErrorMessage } from "@/core/db/errors";
import { optionalDate, optionalText, optionalUuid } from "@/core/lib/form-schemas";
import { deals } from "@/modules/deals/schema";
import { projects } from "@/modules/projects/schema";
import { saleLeads, sales } from "@/modules/sales/schema";
import { taskEntity, tasks, taskStatus, type TaskEntity } from "./schema";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const taskSchema = z.object({
  title: z.string().trim().min(2, "Descreve a tarefa.").max(300),
  assigneeUserId: optionalUuid,
  dueDate: optionalDate,
  status: z.enum(taskStatus.enumValues).default("por_iniciar"),
  notes: optionalText,
});
export type TaskInput = z.input<typeof taskSchema>;

/** Imóvel do registo (para a auditoria) e confirmação de que pertence à organização. */
async function resolveEntity(organizationId: string, entityType: TaskEntity, entityId: string): Promise<{ propertyId: string | null; paths: string[] } | null> {
  if (entityType === "deal") {
    const [d] = await db.select({ propertyId: deals.propertyId }).from(deals).where(and(eq(deals.id, entityId), eq(deals.organizationId, organizationId)));
    return d ? { propertyId: d.propertyId, paths: ["/deals", `/deals/${entityId}`] } : null;
  }
  if (entityType === "project") {
    const [p] = await db.select({ propertyId: projects.propertyId }).from(projects).where(and(eq(projects.id, entityId), eq(projects.organizationId, organizationId)));
    return p ? { propertyId: p.propertyId, paths: ["/projects", `/projects/${entityId}`] } : null;
  }
  if (entityType === "sale") {
    const [s] = await db.select({ propertyId: sales.propertyId }).from(sales).where(and(eq(sales.id, entityId), eq(sales.organizationId, organizationId)));
    return s ? { propertyId: s.propertyId, paths: ["/sales", `/sales/${entityId}`] } : null;
  }
  const [l] = await db.select({ propertyId: saleLeads.propertyId, saleId: saleLeads.saleId }).from(saleLeads).where(and(eq(saleLeads.id, entityId), eq(saleLeads.organizationId, organizationId)));
  return l ? { propertyId: l.propertyId, paths: ["/sales", `/sales/${l.saleId}`] } : null;
}

async function assigneeOk(organizationId: string, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return true;
  const [p] = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.id, userId), eq(profiles.organizationId, organizationId), eq(profiles.isActive, true)));
  return Boolean(p);
}

function revalidate(paths: string[]) {
  for (const p of ["/dashboard", "/tarefas", ...paths]) revalidatePath(p, p.split("/").length > 2 ? "layout" : "page");
}

const NO_ACCESS = { ok: false as const, error: "Sem acesso ao módulo deste registo." };

export async function createTask(entityType: TaskEntity, entityId: string, input: TaskInput): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!taskEntity.enumValues.includes(entityType)) return { ok: false, error: "Tipo de registo inválido." };
  if (!hasModule(user, moduleForEntity(entityType))) return NO_ACCESS;
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const entity = await resolveEntity(user.organizationId, entityType, entityId);
  if (!entity) return { ok: false, error: "Registo não encontrado." };
  if (!(await assigneeOk(user.organizationId, parsed.data.assigneeUserId))) return { ok: false, error: "O responsável tem de ser um utilizador ativo." };
  try {
    const [created] = await db
      .insert(tasks)
      .values({ organizationId: user.organizationId, entityType, entityId, propertyId: entity.propertyId, ...parsed.data, createdBy: user.id, updatedBy: user.id })
      .returning({ id: tasks.id });
    revalidate(entity.paths);
    return { ok: true, id: created!.id };
  } catch (e) {
    return { ok: false, error: dbErrorMessage(e) };
  }
}

/** Edita título, responsável, prazo, estado ou notas. Passar a «concluída» regista quem e quando. */
export async function updateTask(id: string, input: Partial<TaskInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = taskSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, user.organizationId)));
  if (!t) return { ok: false, error: "Tarefa não encontrada." };
  // Quem só é responsável (sem acesso ao módulo) pode mudar o estado e concluir, não o resto.
  const own = t.assigneeUserId === user.id;
  const onlyStatus = Object.keys(parsed.data).every((k) => k === "status");
  if (!hasModule(user, moduleForEntity(t.entityType)) && !(own && onlyStatus)) return NO_ACCESS;
  if (parsed.data.assigneeUserId !== undefined && !(await assigneeOk(user.organizationId, parsed.data.assigneeUserId))) return { ok: false, error: "O responsável tem de ser um utilizador ativo." };
  const d = parsed.data;
  const closing = d.status === "concluida" && t.status !== "concluida";
  const reopening = d.status && d.status !== "concluida" && t.status === "concluida";
  try {
    await db
      .update(tasks)
      .set({
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.assigneeUserId !== undefined ? { assigneeUserId: d.assigneeUserId } : {}),
        ...(d.dueDate !== undefined ? { dueDate: d.dueDate } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(closing ? { completedAt: new Date(), completedBy: user.id } : {}),
        ...(reopening ? { completedAt: null, completedBy: null } : {}),
        updatedBy: user.id,
      })
      .where(eq(tasks.id, id));
  } catch (e) {
    return { ok: false, error: dbErrorMessage(e) };
  }
  const entity = await resolveEntity(user.organizationId, t.entityType, t.entityId);
  revalidate(entity?.paths ?? []);
  return { ok: true };
}

/**
 * Conclui a tarefa e, no mesmo passo, cria a seguinte (opcional). A seguinte
 * herda o registo e, se não vier responsável, o da tarefa concluída.
 */
export async function completeTask(id: string, next?: TaskInput | null): Promise<Result<{ nextId: string | null }>> {
  const user = await requireUser();
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, user.organizationId)));
  if (!t) return { ok: false, error: "Tarefa não encontrada." };
  if (next?.title?.trim() && !hasModule(user, moduleForEntity(t.entityType))) return NO_ACCESS;
  const r = await updateTask(id, { status: "concluida" });
  if (!r.ok) return r;
  if (!next || !next.title?.trim()) return { ok: true, nextId: null };
  const created = await createTask(t.entityType, t.entityId, { ...next, assigneeUserId: next.assigneeUserId || t.assigneeUserId || undefined });
  return created.ok ? { ok: true, nextId: created.id } : created;
}

export async function deleteTask(id: string): Promise<Result> {
  const user = await requireUser();
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, user.organizationId)));
  if (!t) return { ok: false, error: "Tarefa não encontrada." };
  if (!hasModule(user, moduleForEntity(t.entityType))) return NO_ACCESS;
  if (t.status === "concluida" && user.role === "user") return { ok: false, error: "Tarefas concluídas fazem parte do histórico." };
  await db.delete(tasks).where(eq(tasks.id, id));
  const entity = await resolveEntity(user.organizationId, t.entityType, t.entityId);
  revalidate(entity?.paths ?? []);
  return { ok: true };
}

/** Utilizadores ativos para o seletor de responsável (carregado quando o popover abre). */
export async function listAssignees(): Promise<{ id: string; fullName: string }[]> {
  const user = await requireUser();
  return db.select({ id: profiles.id, fullName: profiles.fullName }).from(profiles).where(and(eq(profiles.organizationId, user.organizationId), eq(profiles.isActive, true))).orderBy(profiles.fullName);
}
