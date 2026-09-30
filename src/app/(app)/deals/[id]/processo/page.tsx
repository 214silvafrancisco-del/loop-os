import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { ChecklistPanel } from "@/modules/checklists/components/checklist-panel";
import { getChecklistView } from "@/modules/checklists/queries";
import { listUsers } from "@/modules/settings/queries";

/** Checklist do processo "Novo Negócio" (a sincronização corre no layout). */
export default async function DealProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [view, users] = await Promise.all([getChecklistView(user.organizationId, "deal", id), listUsers(user.organizationId)]);
  if (!view) notFound();
  return <ChecklistPanel view={view} users={users} basePath={`/deals/${id}`} />;
}
