import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { getProject } from "@/modules/projects/queries";
import { TasksPanel } from "@/modules/tasks/components/tasks-panel";
import { listTasksForEntity } from "@/modules/tasks/queries";

/** Tarefas da obra: abertas e histórico. */
export default async function ProjectTarefasPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProject(user.organizationId, id);
  if (!project) notFound();
  const tasks = await listTasksForEntity(user.organizationId, "project", id);
  return <TasksPanel entityType="project" entityId={id} tasks={tasks} canDelete={user.role !== "user"} />;
}
