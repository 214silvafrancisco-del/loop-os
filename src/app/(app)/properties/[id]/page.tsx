import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
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

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requireUser();
  const property = await getProperty(user.organizationId, (await params).id);
  return { title: property ? `${property.ref} · ${property.name ?? property.addressLine}` : "Imóvel" };
}

export default async function PropertyPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const [property, parishes, municipalities] = await Promise.all([
    getProperty(user.organizationId, id),
    listParishes(user.organizationId),
    listMunicipalities(user.organizationId),
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
        actions={canDelete ? <DeletePropertyButton id={property.id} label={property.ref} /> : null}
      />
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
