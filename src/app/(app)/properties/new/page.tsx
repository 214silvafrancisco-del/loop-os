import type { Metadata } from "next";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { createProperty } from "@/modules/properties/actions";
import { PropertyForm } from "@/modules/properties/components/property-form";
import { listMunicipalities, listParishes } from "@/modules/properties/queries";

export const metadata: Metadata = { title: "Novo imóvel" };

export default async function NewPropertyPage() {
  const user = await requireUser();
  const [parishes, municipalities] = await Promise.all([
    listParishes(user.organizationId),
    listMunicipalities(user.organizationId),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Novo imóvel"
        description="Normalmente o imóvel nasce com o negócio. Cria aqui só imóveis sem negócio associado."
      />
      <PropertyForm
        action={createProperty}
        cancelHref="/properties"
        parishes={parishes}
        municipalities={municipalities}
      />
    </div>
  );
}
