"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/core/db/client";
import { profiles, userModules } from "@/core/db/schema";
import { dbErrorMessage } from "@/core/db/errors";
import { tasks } from "@/modules/tasks/schema";
import { isAppModule } from "./access";
import { requireAdmin } from "./current-user";

type Result = { ok: true } | { ok: false; error: string };

async function sameOrg(organizationId: string, userId: string) {
  const [p] = await db.select({ id: profiles.id, role: profiles.role }).from(profiles).where(and(eq(profiles.id, userId), eq(profiles.organizationId, organizationId)));
  return p ?? null;
}

/** Liga ou desliga o acesso de um utilizador a um módulo. Só o admin; nunca sobre si próprio. */
export async function setUserModule(userId: string, module: string, enabled: boolean): Promise<Result> {
  const admin = await requireAdmin();
  if (!isAppModule(module)) return { ok: false, error: "Módulo desconhecido." };
  const target = await sameOrg(admin.organizationId, userId);
  if (!target) return { ok: false, error: "Utilizador não encontrado." };
  if (target.id === admin.id || target.role === "admin") return { ok: false, error: "O admin tem sempre acesso global." };
  try {
    if (enabled) await db.insert(userModules).values({ userId, module, createdBy: admin.id }).onConflictDoNothing();
    else await db.delete(userModules).where(and(eq(userModules.userId, userId), eq(userModules.module, module)));
  } catch (e) {
    return { ok: false, error: dbErrorMessage(e) };
  }
  revalidatePath("/settings/utilizadores");
  return { ok: true };
}

/** Desativa (revoga o acesso, preserva histórico) ou reativa um utilizador. */
export async function setUserActive(userId: string, active: boolean): Promise<Result> {
  const admin = await requireAdmin();
  const target = await sameOrg(admin.organizationId, userId);
  if (!target) return { ok: false, error: "Utilizador não encontrado." };
  if (target.id === admin.id) return { ok: false, error: "Não podes desativar a tua própria conta." };
  await db.update(profiles).set({ isActive: active }).where(eq(profiles.id, userId));
  revalidatePath("/settings/utilizadores");
  return { ok: true };
}

/** Reatribui as tarefas abertas de um utilizador a outro (ou a ninguém). O histórico fica na auditoria. */
export async function reassignOpenTasks(fromUserId: string, toUserId: string | null): Promise<Result & { moved?: number }> {
  const admin = await requireAdmin();
  if (!(await sameOrg(admin.organizationId, fromUserId))) return { ok: false, error: "Utilizador não encontrado." };
  if (toUserId && !(await sameOrg(admin.organizationId, toUserId))) return { ok: false, error: "Destino não encontrado." };
  const moved = await db
    .update(tasks)
    .set({ assigneeUserId: toUserId, updatedBy: admin.id })
    .where(and(eq(tasks.organizationId, admin.organizationId), eq(tasks.assigneeUserId, fromUserId), ne(tasks.status, "concluida")))
    .returning({ id: tasks.id });
  revalidatePath("/settings/utilizadores");
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  return { ok: true, moved: moved.length };
}
