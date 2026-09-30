import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { MeasurementsList } from "@/modules/projects/components/measurements-list";
import { getAdvancePctBySupplier, listMeasurements } from "@/modules/projects/measurements/queries";
import { getProject } from "@/modules/projects/queries";
import { listProjectSuppliers } from "@/modules/projects/suppliers/queries";
import { documentCategories } from "@/modules/settings/schema";

export default async function ProjectAutosPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const project = await getProject(orgId, id);
  if (!project) notFound();
  const [measurements, suppliers, advancePct, [category]] = await Promise.all([
    listMeasurements(orgId, id),
    listProjectSuppliers(orgId, id),
    getAdvancePctBySupplier(id),
    db
      .select({ id: documentCategories.id })
      .from(documentCategories)
      .where(and(eq(documentCategories.organizationId, orgId), eq(documentCategories.group, "tecnico"), eq(documentCategories.name, "Auto de medição")))
      .limit(1),
  ]);
  return (
    <MeasurementsList
      projectId={id}
      propertyId={project.propertyId}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, controlMode: s.controlMode, budgeted: s.budgeted, advancePct: advancePct.get(s.id) ?? 0 }))}
      measurements={measurements}
      documentCategoryId={category?.id ?? null}
    />
  );
}
