import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { getDeal } from "@/modules/deals/queries";
import { DocumentsPanel } from "@/modules/documents/components/documents-panel";
import { listDocumentCategories, listDocumentsForProperty } from "@/modules/documents/queries";

/** Documentos do negócio e do imóvel, sem duplicar: tudo o que pertence ao mesmo imóvel. */
export default async function DealDocumentosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ categoria?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { categoria } = await searchParams;
  const deal = await getDeal(user.organizationId, id);
  if (!deal) notFound();

  const [documents, categories] = await Promise.all([
    listDocumentsForProperty(user.organizationId, deal.propertyId),
    listDocumentCategories(user.organizationId),
  ]);

  return (
    <DocumentsPanel
      context={{ propertyId: deal.propertyId, entityType: "deal", entityId: deal.id }}
      documents={documents}
      categories={categories}
      canDelete={user.role !== "user"}
      showOrigin
      defaultCategoryName={categoria}
    />
  );
}
