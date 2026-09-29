import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { updateProperty } from "@/modules/properties/actions";
import {
  PropertyRef,
  PropertyStatusBadge,
  propertySummary,
} from "@/modules/properties/components/property-badges";
import { DeletePropertyButton } from "@/modules/properties/components/delete-property-button";
import { PropertyForm } from "@/modules/properties/components/property-form";
import { getProperty, listMunicipalities, listParishes } from "@/modules/properties/queries";
import { PROPERTY_TYPE_LABEL } from "@/modules/properties/validation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { StageBadge } from "@/modules/deals/components/deal-badges";
import { dealRef } from "@/modules/deals/components/deals-table";
import { listDealsForProperty } from "@/modules/deals/queries";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requireUser();
  const property = await getProperty(user.organizationId, (await params).id);
  return { title: property ? `${property.ref} · ${property.name ?? property.addressLine}` : "Imóvel" };
}

export default async function PropertyPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const [property, parishes, municipalities, deals] = await Promise.all([
    getProperty(user.organizationId, id),
    listParishes(user.organizationId),
    listMunicipalities(user.organizationId),
    listDealsForProperty(user.organizationId, id),
  ]);
  if (!property) notFound();

  const canDelete = user.role !== "user";
  const update = updateProperty.bind(null, property.id);
  const subtitle = [PROPERTY_TYPE_LABEL[property.propertyType], propertySummary(property), property.parish]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 flex items-center gap-3">
        <PropertyRef value={property.ref} className="text-sm" />
        <PropertyStatusBadge status={property.status} />
      </div>
      <PageHeader
        title={property.name ?? property.addressLine}
        description={subtitle}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/properties/${property.id}/documentos`}>Documentos</Link>
            </Button>
            {canDelete && deals.length === 0 ? <DeletePropertyButton id={property.id} label={property.ref} /> : null}
          </>
        }
      />

      <section className="mb-5 rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Negócios</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/deals/new">Novo negócio para este imóvel</Link>
          </Button>
        </div>
        {deals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem negócios associados.</p>
        ) : (
          <ul className="divide-y">
            {deals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <PropertyRef value={dealRef(d)} />
                <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
                  {d.name ?? d.addressLine}
                </Link>
                <StageBadge name={d.stageName} color={d.stageColor} />
                {d.status === "excluded" ? <span className="text-xs text-muted-foreground">excluído</span> : null}
                <span className="ml-auto text-muted-foreground">
                  {formatCurrency(d.askingPrice)} · {formatDate(d.enteredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PropertyForm
        action={update}
        property={property}
        cancelHref="/properties"
        parishes={parishes}
        municipalities={municipalities}
      />
    </div>
  );
}
