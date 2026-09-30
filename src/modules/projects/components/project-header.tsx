import Link from "next/link";
import { Building2, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChecklistProgress } from "@/modules/checklists/components/checklist-progress";
import type { ChecklistView } from "@/modules/checklists/queries";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { PropertyRef } from "@/modules/properties/components/property-badges";
import type { ProjectRow } from "../queries";
import { ProjectStatusSelect } from "./project-badges";

export function ProjectHeader({ row, checklist }: { row: ProjectRow; checklist?: ChecklistView | null }) {
  const facts = [
    row.typology,
    row.parish ?? row.municipality,
    row.finalPrice ? `comprado por ${formatCurrency(row.finalPrice)}` : null,
    row.actualStart ? `início ${formatDate(row.actualStart)}` : row.plannedStart ? `início previsto ${formatDate(row.plannedStart)}` : null,
    row.actualEnd ? `concluída ${formatDate(row.actualEnd)}` : row.plannedEnd ? `fim previsto ${formatDate(row.plannedEnd)}` : null,
    row.managerName ? `resp. ${row.managerName}` : null,
  ].filter(Boolean);

  return (
    <header className="mb-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <PropertyRef value={row.ref} className="text-sm" />
        <ProjectStatusSelect projectId={row.id} status={row.status} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{row.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{row.addressLine}</p>
          <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link href={`/deals/${row.dealId}`}>
              <Handshake className="size-4" />
              Negócio
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link href={`/properties/${row.propertyId}`}>
              <Building2 className="size-4" />
              Imóvel {row.ref}
            </Link>
          </Button>
        </div>
      </div>
      {checklist ? (
        <ChecklistProgress
          className="mt-3 md:max-w-md"
          done={checklist.doneCount}
          total={checklist.totalCount}
          processHref={`/projects/${row.id}/processo`}
          nextStep={
            checklist.nextStep
              ? { label: checklist.nextStep.label, isRequired: checklist.nextStep.isRequired, href: `/projects/${row.id}/${checklist.nextStep.linkPath ?? "processo"}` }
              : null
          }
        />
      ) : null}
    </header>
  );
}
