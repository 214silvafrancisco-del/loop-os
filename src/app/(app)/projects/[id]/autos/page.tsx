import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { MeasurementsList } from "@/modules/projects/components/measurements-list";
import { listMeasurements } from "@/modules/projects/measurements/queries";
import { getProject } from "@/modules/projects/queries";
import { listProjectSuppliers } from "@/modules/projects/suppliers/queries";

export default async function ProjectAutosPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProject(user.organizationId, id);
  if (!project) notFound();
  const [measurements, suppliers] = await Promise.all([listMeasurements(user.organizationId, id), listProjectSuppliers(user.organizationId, id)]);
  return (
    <MeasurementsList
      projectId={id}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, controlMode: s.controlMode, budgeted: s.budgeted }))}
      measurements={measurements}
    />
  );
}
