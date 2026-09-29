import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { updateProject } from "@/modules/projects/actions";
import { sumBudget } from "@/modules/projects/budget/queries";
import { ProjectForm } from "@/modules/projects/components/project-form";
import { ProjectSummary } from "@/modules/projects/components/project-summary";
import { getExecutedTotal } from "@/modules/projects/measurements/queries";
import { getProject } from "@/modules/projects/queries";
import { listUsers } from "@/modules/settings/queries";

export default async function ProjectResumoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const [project, users, budgeted, executed] = await Promise.all([
    getProject(orgId, id),
    listUsers(orgId),
    sumBudget(orgId, id),
    getExecutedTotal(orgId, id),
  ]);
  if (!project) notFound();

  return (
    <>
      <ProjectSummary
        s={{
          projectId: id,
          budgeted,
          executed: executed.executed,
          invoiced: 0,
          paid: 0,
          lastMeasurement: executed.lastNumber && executed.lastMonth ? { number: executed.lastNumber, month: executed.lastMonth } : null,
        }}
      />
      <ProjectForm action={updateProject.bind(null, project.id)} project={project} users={users} cancelHref="/projects" />
    </>
  );
}
