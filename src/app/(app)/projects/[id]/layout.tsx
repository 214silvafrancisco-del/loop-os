import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
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
  return (
    <div className="mx-auto max-w-5xl">
      <ProjectHeader row={row} />
      <ProjectTabs projectId={row.id} />
      {children}
    </div>
  );
}
