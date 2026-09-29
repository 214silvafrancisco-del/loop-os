import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { updateProject } from "@/modules/projects/actions";
import { ProjectForm } from "@/modules/projects/components/project-form";
import { ProjectSummary } from "@/modules/projects/components/project-summary";
import { getProjectFinancials } from "@/modules/projects/invoices/queries";
import { getExecutedTotal } from "@/modules/projects/measurements/queries";
import { getProject } from "@/modules/projects/queries";
import { listUsers } from "@/modules/settings/queries";

export default async function ProjectResumoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const [project, users, fin, executed] = await Promise.all([
    getProject(orgId, id),
    listUsers(orgId),
    getProjectFinancials(orgId, id),
    getExecutedTotal(orgId, id),
  ]);
  if (!project) notFound();

  return (
    <>
      <ProjectSummary
        s={{
          projectId: id,
          budgeted: fin.budgeted,
          executed: fin.executed,
          invoiced: fin.invoicedNet,
          paid: fin.paid,
          unpaid: fin.unpaid,
          overdueCount: fin.overdueCount,
          lastMeasurement: executed.lastNumber && executed.lastMonth ? { number: executed.lastNumber, month: executed.lastMonth } : null,
        }}
      />
      <ProjectForm action={updateProject.bind(null, project.id)} project={project} users={users} cancelHref="/projects" />
    </>
  );
}
