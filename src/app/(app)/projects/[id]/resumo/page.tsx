import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { updateProject } from "@/modules/projects/actions";
import { ProjectForm } from "@/modules/projects/components/project-form";
import { getProject } from "@/modules/projects/queries";
import { listUsers } from "@/modules/settings/queries";

export default async function ProjectResumoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [project, users] = await Promise.all([getProject(user.organizationId, id), listUsers(user.organizationId)]);
  if (!project) notFound();
  return <ProjectForm action={updateProject.bind(null, project.id)} project={project} users={users} cancelHref="/projects" />;
}
