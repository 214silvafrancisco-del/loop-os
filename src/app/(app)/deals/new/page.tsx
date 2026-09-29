import type { Metadata } from "next";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { listContacts } from "@/modules/contacts/queries";
import { createDeal } from "@/modules/deals/actions";
import { DealCreateForm } from "@/modules/deals/components/deal-create-form";
import { listMunicipalities, listParishes } from "@/modules/properties/queries";
import { listDealStages, listSourceChannels, listUsers } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Novo negócio" };

export default async function NewDealPage() {
  const user = await requireUser();
  const orgId = user.organizationId;
  const [stages, sources, users, contacts, parishes, municipalities] = await Promise.all([
    listDealStages(orgId),
    listSourceChannels(orgId),
    listUsers(orgId),
    listContacts(orgId, { limit: 500 }),
    listParishes(orgId),
    listMunicipalities(orgId),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Novo negócio" description="Cria o imóvel e o negócio de uma vez." />
      <DealCreateForm
        action={createDeal}
        stages={stages}
        sources={sources}
        users={users}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, companyName: c.companyName, phone: c.phone }))}
        currentUserId={user.id}
        parishes={parishes}
        municipalities={municipalities}
      />
    </div>
  );
}
