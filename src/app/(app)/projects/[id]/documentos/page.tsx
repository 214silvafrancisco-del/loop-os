import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { DocumentsPanel } from "@/modules/documents/components/documents-panel";
import { listDocumentCategories, listDocumentsForProperty } from "@/modules/documents/queries";
import { getProject } from "@/modules/projects/queries";

/** Documentos da obra e do imóvel (projetos, licenças, fotografias de obra). */
export default async function ProjectDocumentosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ categoria?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { categoria } = await searchParams;
  const project = await getProject(user.organizationId, id);
  if (!project) notFound();
  const [documents, categories] = await Promise.all([
    listDocumentsForProperty(user.organizationId, project.propertyId),
    listDocumentCategories(user.organizationId),
  ]);
  return (
    <DocumentsPanel
      context={{ propertyId: project.propertyId, entityType: "project", entityId: project.id }}
      documents={documents}
      categories={categories}
      canDelete={user.role !== "user"}
      showOrigin
      defaultCategoryName={categoria}
    />
  );
}
