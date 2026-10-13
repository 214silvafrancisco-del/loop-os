import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { getDeal } from "@/modules/deals/queries";
import { TasksPanel } from "@/modules/tasks/components/tasks-panel";
import { listTasksForEntity } from "@/modules/tasks/queries";

/** Tarefas do negócio: abertas e histórico. */
export default async function DealTarefasPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const deal = await getDeal(user.organizationId, id);
  if (!deal) notFound();
  const tasks = await listTasksForEntity(user.organizationId, "deal", id);
  return <TasksPanel entityType="deal" entityId={id} tasks={tasks} canDelete={user.role !== "user"} />;
}
