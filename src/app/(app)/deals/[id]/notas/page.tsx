import { requireUser } from "@/core/auth/current-user";
import { NotesPanel } from "@/modules/deals/components/notes-panel";
import { listDealNotes } from "@/modules/deals/notes-queries";

export default async function DealNotasPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const notes = await listDealNotes(user.organizationId, id);
  return <NotesPanel dealId={id} notes={notes} currentUserId={user.id} canModerate={user.role !== "user"} />;
}
