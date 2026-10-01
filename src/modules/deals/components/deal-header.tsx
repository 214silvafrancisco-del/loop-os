import Link from "next/link";
import { Building2, ExternalLink, Phone } from "lucide-react";
import { ChecklistProgress } from "@/modules/checklists/components/checklist-progress";
import type { ChecklistView } from "@/modules/checklists/queries";
import { CreateProjectButton } from "@/modules/projects/components/create-project-button";
import { CreateSaleButton } from "@/modules/sales/components/create-sale-button";
import type { SaleStage } from "@/modules/sales/schema";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { PropertyRef } from "@/modules/properties/components/property-badges";
import type { DealStage } from "@/modules/settings/queries";
import type { DealListRow } from "../queries";
import type { Deal } from "../schema";
import { dealRef, floorLabel } from "../utils";
import { DealStatusBadge } from "./deal-badges";
import { DealStatusButton } from "./deal-status-button";
import { NextActionEditor } from "./next-action-editor";
import { StageSelect } from "./stage-select";

type Props = { deal: Deal; row: DealListRow; stages: DealStage[]; project: { id: string; name: string } | null; sale?: { id: string; stage: SaleStage } | null; checklist?: ChecklistView | null };

/** Cabeçalho comum a todas as tabs do negócio. */
export function DealHeader({ deal, row, stages, project, sale = null, checklist }: Props) {
  const label = `${dealRef(row)} · ${deal.name ?? row.addressLine}`;
  const facts = [
    row.typology,
    floorLabel(row.floor),
    row.parish ?? row.municipality,
    deal.askingPrice ? `pedido ${formatCurrency(deal.askingPrice)}` : null,
    deal.finalPrice ? `comprado por ${formatCurrency(deal.finalPrice)}` : null,
    `entrada ${formatDate(deal.enteredAt)}`,
  ].filter(Boolean);
  const canCreateProject = row.stageIsPurchase && Boolean(deal.deedDate);

  return (
    <header className="mb-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <PropertyRef value={dealRef(row)} className="text-sm" />
        <StageSelect
          dealId={deal.id}
          dealLabel={label}
          stageId={deal.stageId}
          stages={stages}
          askingPrice={deal.askingPrice}
          disabled={deal.status !== "active"}
        />
        <DealStatusBadge status={deal.status} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{deal.name ?? row.addressLine}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{facts.join(" · ")}</p>
          {row.contactName ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="size-3.5" />
              {row.contactName}
              {row.contactPhone ? (
                <a href={`tel:${row.contactPhone}`} className="hover:underline">
                  {row.contactPhone}
                </a>
              ) : null}
              {row.sourceName ? <span>· {row.sourceName}</span> : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link href={`/properties/${deal.propertyId}`}>
              <Building2 className="size-4" />
              Imóvel {row.ref}
            </Link>
          </Button>
          {deal.listingUrl ? (
            <Button asChild variant="outline" size="sm" className="gap-1">
              <a href={deal.listingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Anúncio
              </a>
            </Button>
          ) : null}
          <CreateProjectButton dealId={deal.id} existing={project} canCreate={canCreateProject && deal.status === "active"} />
          <CreateSaleButton dealId={deal.id} existing={sale} canCreate={canCreateProject && deal.status === "active"} />
          <DealStatusButton id={deal.id} status={deal.status} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <NextActionEditor dealId={deal.id} action={deal.nextAction} date={deal.nextActionDate} />
        </div>
        {checklist ? (
          <ChecklistProgress
            done={checklist.doneCount}
            total={checklist.totalCount}
            processHref={`/deals/${deal.id}/processo`}
            nextStep={
              checklist.nextStep
                ? {
                    label: checklist.nextStep.label,
                    isRequired: checklist.nextStep.isRequired,
                    href: `/deals/${deal.id}/${checklist.nextStep.linkPath ?? "processo"}`,
                  }
                : null
            }
          />
        ) : null}
      </div>
    </header>
  );
}
