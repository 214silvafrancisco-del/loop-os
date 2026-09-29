import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { NativeSelect } from "@/core/ui/form-field";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectsTable } from "@/modules/projects/components/projects-table";
import { listProjects } from "@/modules/projects/queries";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectStatus } from "@/modules/projects/validation";
import { listUsers } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Obras" };

type Search = { q?: string; status?: string; manager?: string };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = (PROJECT_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as ProjectStatus) : undefined;
  const [projects, users] = await Promise.all([
    listProjects(user.organizationId, { q: sp.q, status, managerUserId: sp.manager || undefined }),
    listUsers(user.organizationId),
  ]);
  const hasFilters = Boolean(sp.q || status || sp.manager);

  return (
    <>
      <PageHeader title="Obras" description="Orçamento, autos de medição, faturas e pagamentos." />

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Nome, ref, morada, freguesia" className="pl-8" />
        </div>
        <NativeSelect name="status" defaultValue={status ?? ""} className="w-auto">
          <option value="">Todos os estados</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="manager" defaultValue={sp.manager ?? ""} className="w-auto">
          <option value="">Responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">Filtrar</Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/projects">Limpar</Link>
          </Button>
        ) : null}
      </form>

      <p className="mb-2 text-xs text-muted-foreground">{projects.length} {projects.length === 1 ? "obra" : "obras"}</p>
      <ProjectsTable projects={projects} />
    </>
  );
}
