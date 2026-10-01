import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { DocumentsPanel } from "@/modules/documents/components/documents-panel";
import { listDocumentCategories, listDocumentsForProperty } from "@/modules/documents/queries";
import { getSale } from "@/modules/sales/queries";

/** Documentos do imóvel reutilizados na venda; o que se carrega aqui fica ligado à venda. */
export default async function SaleDocumentosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ categoria?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { categoria } = await searchParams;
  const sale = await getSale(user.organizationId, id);
  if (!sale) notFound();
  const [documents, categories] = await Promise.all([listDocumentsForProperty(user.organizationId, sale.propertyId), listDocumentCategories(user.organizationId)]);
  return (
    <DocumentsPanel
      context={{ propertyId: sale.propertyId, entityType: "sale", entityId: sale.id }}
      documents={documents}
      categories={categories}
      canDelete={user.role !== "user"}
      showOrigin
      defaultCategoryName={categoria}
    />
  );
}
