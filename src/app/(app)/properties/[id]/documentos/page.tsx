import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { DocumentsPanel } from "@/modules/documents/components/documents-panel";
import { listDocumentCategories, listDocumentsForProperty } from "@/modules/documents/queries";
import { PropertyRef } from "@/modules/properties/components/property-badges";
import { getProperty } from "@/modules/properties/queries";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requireUser();
  const p = await getProperty(user.organizationId, (await params).id);
  return { title: p ? `Documentos · ${p.ref}` : "Documentos" };
}

export default async function PropertyDocumentosPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const property = await getProperty(user.organizationId, id);
  if (!property) notFound();

  const [documents, categories] = await Promise.all([
    listDocumentsForProperty(user.organizationId, property.id),
    listDocumentCategories(user.organizationId),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 flex items-center gap-3">
        <PropertyRef value={property.ref} className="text-sm" />
      </div>
      <PageHeader
        title={`Documentos · ${property.name ?? property.addressLine}`}
        description="Todos os documentos do imóvel, dos seus negócios e obras."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link href={`/properties/${property.id}`}>
              <ArrowLeft className="size-4" />
              Ficha do imóvel
            </Link>
          </Button>
        }
      />
      <DocumentsPanel
        context={{ propertyId: property.id, entityType: "property", entityId: property.id }}
        documents={documents}
        categories={categories}
        canDelete={user.role !== "user"}
        showOrigin
      />
    </div>
  );
}
