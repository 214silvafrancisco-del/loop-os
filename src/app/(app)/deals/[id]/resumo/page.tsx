import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { listContacts } from "@/modules/contacts/queries";
import { updateDeal } from "@/modules/deals/actions";
import { DealForm } from "@/modules/deals/components/deal-form";
import { getDeal } from "@/modules/deals/queries";
import { listDealStages, listSourceChannels, listUsers } from "@/modules/settings/queries";

export default async function DealResumoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const [deal, stages, sources, users, contacts] = await Promise.all([
    getDeal(orgId, id),
    listDealStages(orgId, false),
    listSourceChannels(orgId),
    listUsers(orgId),
    listContacts(orgId, { limit: 500 }),
  ]);
  if (!deal) notFound();

  return (
    <DealForm
      action={updateDeal.bind(null, deal.id)}
      deal={deal}
      stages={stages.filter((s) => s.isActive || s.id === deal.stageId)}
      sources={sources}
      users={users}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name, companyName: c.companyName, phone: c.phone }))}
      cancelHref="/deals"
    />
  );
}
