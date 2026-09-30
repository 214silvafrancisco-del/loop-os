import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { getChecklistView } from "@/modules/checklists/queries";
import { syncChecklist } from "@/modules/checklists/sync";
import { ProjectHeader } from "@/modules/projects/components/project-header";
import { ProjectTabs } from "@/modules/projects/components/project-tabs";
import { getProjectRow } from "@/modules/projects/queries";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requireUser();
  const row = await getProjectRow(user.organizationId, (await params).id);
  return { title: row ? `Obra ${row.ref} · ${row.name}` : "Obra" };
}

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const row = await getProjectRow(user.organizationId, id);
  if (!row) notFound();

  // Checklist "Nova Obra": sincroniza a cada abertura (idempotente).
  await syncChecklist(user.organizationId, "project", id, user.id);
  const checklist = await getChecklistView(user.organizationId, "project", id);

  return (
    <div className="mx-auto max-w-5xl">
      <ProjectHeader row={row} checklist={checklist} />
      <ProjectTabs projectId={row.id} counts={{ processo: checklist ? checklist.totalCount - checklist.doneCount : undefined }} />
      {children}
    </div>
  );
}
