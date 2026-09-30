import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { ChecklistPanel } from "@/modules/checklists/components/checklist-panel";
import { getChecklistView } from "@/modules/checklists/queries";
import { syncChecklist } from "@/modules/checklists/sync";
import { listUsers } from "@/modules/settings/queries";

/** Checklist do processo "Nova Obra" (a sincronização corre no layout). */
export default async function ProjectProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // O layout sincroniza, mas layout e página renderizam em paralelo: na
  // primeira abertura a instância pode ainda não existir. Garantimos aqui.
  const users = await listUsers(user.organizationId);
  let view = await getChecklistView(user.organizationId, "project", id);
  if (!view) {
    await syncChecklist(user.organizationId, "project", id, user.id);
    view = await getChecklistView(user.organizationId, "project", id);
  }
  if (!view) notFound();
  return <ChecklistPanel view={view} users={users} basePath={`/projects/${id}`} />;
}
