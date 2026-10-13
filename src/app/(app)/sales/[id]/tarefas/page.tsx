import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { getSale } from "@/modules/sales/queries";
import { TasksPanel } from "@/modules/tasks/components/tasks-panel";
import { listTasksForEntity } from "@/modules/tasks/queries";

/** Tarefas da venda: abertas e histórico. */
export default async function SaleTarefasPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sale = await getSale(user.organizationId, id);
  if (!sale) notFound();
  const tasks = await listTasksForEntity(user.organizationId, "sale", id);
  return <TasksPanel entityType="sale" entityId={id} tasks={tasks} canDelete={user.role !== "user"} />;
}
