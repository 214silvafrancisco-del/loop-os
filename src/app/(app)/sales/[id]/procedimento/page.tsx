import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { ChecklistPanel } from "@/modules/checklists/components/checklist-panel";
import { getChecklistView } from "@/modules/checklists/queries";
import { syncChecklist } from "@/modules/checklists/sync";
import { listUsers } from "@/modules/settings/queries";

/** Checklist do procedimento «Venda» (a sincronização corre no layout). */
export default async function SaleProcedimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const users = await listUsers(user.organizationId);
  let view = await getChecklistView(user.organizationId, "sale", id);
  if (!view) {
    await syncChecklist(user.organizationId, "sale", id, user.id);
    view = await getChecklistView(user.organizationId, "sale", id);
  }
  if (!view) notFound();
  return <ChecklistPanel view={view} users={users} basePath={`/sales/${id}`} />;
}
