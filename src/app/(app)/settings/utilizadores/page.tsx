import type { Metadata } from "next";
import { and, eq, ne, sql } from "drizzle-orm";
import { requireAdmin } from "@/core/auth/current-user";
import { UsersMatrix, type MatrixUser } from "@/core/auth/components/users-matrix";
import { effectiveModules } from "@/core/auth/access";
import { db } from "@/core/db/client";
import { profiles, userModules } from "@/core/db/schema";
import { PageHeader } from "@/core/ui/page-header";
import { tasks } from "@/modules/tasks/schema";

export const metadata: Metadata = { title: "Utilizadores" };

/** Matriz de acessos (só admin): utilizadores nas linhas, módulos nas colunas. */
export default async function UsersPage() {
  const admin = await requireAdmin();
  const [rows, grants, open] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.organizationId, admin.organizationId)).orderBy(profiles.fullName),
    db.select({ userId: userModules.userId, module: userModules.module }).from(userModules),
    db
      .select({ userId: tasks.assigneeUserId, n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(eq(tasks.organizationId, admin.organizationId), ne(tasks.status, "concluida")))
      .groupBy(tasks.assigneeUserId),
  ]);
  const openBy = new Map(open.map((o) => [o.userId, o.n]));
  const users: MatrixUser[] = rows.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    email: p.email,
    role: p.role,
    isActive: p.isActive,
    modules: effectiveModules(p.role, grants.filter((g) => g.userId === p.id).map((g) => g.module)),
    openTasks: openBy.get(p.id) ?? 0,
  }));
  return (
    <>
      <PageHeader title="Utilizadores e acessos" description="Quem entra na LOOP OS e a que módulos tem acesso. Dashboard, Tarefas e notificações são sempre acessíveis." />
      <UsersMatrix users={users} adminId={admin.id} />
    </>
  );
}
