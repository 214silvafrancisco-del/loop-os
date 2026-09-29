import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ExternalLink, Phone } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { listContacts } from "@/modules/contacts/queries";
import { updateDeal } from "@/modules/deals/actions";
import { DealStatusBadge, StageBadge } from "@/modules/deals/components/deal-badges";
import { DealForm } from "@/modules/deals/components/deal-form";
import { DealStatusButton } from "@/modules/deals/components/deal-status-button";
import { dealRef } from "@/modules/deals/components/deals-table";
import { getDeal, getDealRow } from "@/modules/deals/queries";
import { PropertyRef } from "@/modules/properties/components/property-badges";
import { listDealStages, listSourceChannels, listUsers } from "@/modules/settings/queries";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requireUser();
  const row = await getDealRow(user.organizationId, (await params).id);
  return { title: row ? `${dealRef(row)} · ${row.name ?? row.addressLine}` : "Negócio" };
}

export default async function DealPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const [deal, row, stages, sources, users, contacts] = await Promise.all([
    getDeal(orgId, id),
    getDealRow(orgId, id),
    listDealStages(orgId, false),
    listSourceChannels(orgId),
    listUsers(orgId),
    listContacts(orgId, { limit: 500 }),
  ]);
  if (!deal || !row) notFound();

  const update = updateDeal.bind(null, deal.id);
  const facts = [
    row.typology,
    row.floor ? (/^\d+$/.test(row.floor) ? `${row.floor}.º` : row.floor) : null,
    row.parish ?? row.municipality,
    deal.askingPrice ? `pedido ${formatCurrency(deal.askingPrice)}` : null,
    `entrada ${formatDate(deal.enteredAt)}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <PropertyRef value={dealRef(row)} className="text-sm" />
        <StageBadge name={row.stageName} color={row.stageColor} />
        <DealStatusBadge status={deal.status} />
      </div>
      <PageHeader
        title={deal.name ?? row.addressLine}
        description={facts.join(" · ")}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href={`/properties/${deal.propertyId}`}>
                <Building2 className="size-4" />
                Imóvel {row.ref}
              </Link>
            </Button>
            {deal.listingUrl ? (
              <Button asChild variant="outline" size="sm" className="gap-1">
                <a href={deal.listingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Anúncio
                </a>
              </Button>
            ) : null}
            <DealStatusButton id={deal.id} status={deal.status} />
          </>
        }
      />

      {row.contactName ? (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="size-4" />
          {row.contactName}
          {row.contactPhone ? (
            <a href={`tel:${row.contactPhone}`} className="hover:underline">
              {row.contactPhone}
            </a>
          ) : null}
          {row.sourceName ? <span>· {row.sourceName}</span> : null}
        </p>
      ) : null}

      <DealForm
        action={update}
        deal={deal}
        stages={stages}
        sources={sources}
        users={users}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, companyName: c.companyName, phone: c.phone }))}
        cancelHref="/deals"
      />
    </div>
  );
}
