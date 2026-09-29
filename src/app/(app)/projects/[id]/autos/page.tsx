import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { sumBudget } from "@/modules/projects/budget/queries";
import { MeasurementsList } from "@/modules/projects/components/measurements-list";
import { listMeasurements } from "@/modules/projects/measurements/queries";
import { getProject } from "@/modules/projects/queries";

export default async function ProjectAutosPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProject(user.organizationId, id);
  if (!project) notFound();
  const [measurements, budgetTotal] = await Promise.all([
    listMeasurements(user.organizationId, id),
    sumBudget(user.organizationId, id),
  ]);
  return <MeasurementsList projectId={id} measurements={measurements} budgetTotal={budgetTotal} />;
}
