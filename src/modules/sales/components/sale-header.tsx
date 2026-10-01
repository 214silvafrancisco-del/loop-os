import Link from "next/link";
import { Building2, ExternalLink, Handshake, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChecklistProgress } from "@/modules/checklists/components/checklist-progress";
import type { ChecklistView } from "@/modules/checklists/queries";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { todayIso } from "@/core/lib/dates";
import { floorLabel } from "@/modules/deals/utils";
import { PropertyRef } from "@/modules/properties/components/property-badges";
import { daysOnMarket } from "../constants";
import type { SaleListRow } from "../queries";
import type { Sale } from "../schema";
import { DeleteSaleButton } from "./delete-sale-button";
import { SaleNextAction } from "./sale-next-action";
import { SaleStageSelect } from "./sale-stage-select";

type Props = { sale: Sale; row: SaleListRow; canDelete: boolean; checklist?: ChecklistView | null };

/** Cabeçalho comum a todas as tabs da venda. */
export function SaleHeader({ sale, row, canDelete, checklist }: Props) {
  const title = row.dealName ?? row.addressLine;
  const days = daysOnMarket(sale.listingDate, sale.deedDate, todayIso());
  const facts = [
    row.typology,
    floorLabel(row.floor),
    row.parish ?? row.municipality,
    sale.listingPrice ? `anunciado ${formatCurrency(sale.listingPrice)}` : null,
    sale.salePrice ? `${sale.stage === "vendido" ? "vendido" : "acordado"} por ${formatCurrency(sale.salePrice)}` : null,
    days !== null ? `${days} dias no mercado` : null,
    sale.deedDate ? `escritura ${formatDate(sale.deedDate)}` : null,
  ].filter(Boolean);

  return (
    <header className="mb-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <PropertyRef value={row.ref} className="text-sm" />
        <SaleStageSelect saleId={sale.id} label={`${row.ref} · ${title}`} stage={sale.stage} salePrice={sale.salePrice} deedDate={sale.deedDate} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{facts.join(" · ")}</p>
          {row.agencies ? <p className="mt-1 text-sm text-muted-foreground">Mediadoras: {row.agencies}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link href={`/properties/${sale.propertyId}`}>
              <Building2 className="size-4" />
              Imóvel {row.ref}
            </Link>
          </Button>
          {sale.dealId ? (
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href={`/deals/${sale.dealId}`}>
                <Handshake className="size-4" />
                Negócio
              </Link>
            </Button>
          ) : null}
          {sale.projectId ? (
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href={`/projects/${sale.projectId}`}>
                <HardHat className="size-4" />
                Obra
              </Link>
            </Button>
          ) : null}
          {sale.listingUrl ? (
            <Button asChild variant="outline" size="sm" className="gap-1">
              <a href={sale.listingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Anúncio
              </a>
            </Button>
          ) : null}
          {canDelete ? <DeleteSaleButton saleId={sale.id} /> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <SaleNextAction saleId={sale.id} action={sale.nextAction} date={sale.nextActionDate} />
        </div>
        {checklist ? (
          <ChecklistProgress
            done={checklist.doneCount}
            total={checklist.totalCount}
            processHref={`/sales/${sale.id}/procedimento`}
            nextStep={checklist.nextStep ? { label: checklist.nextStep.label, isRequired: checklist.nextStep.isRequired, href: `/sales/${sale.id}/${checklist.nextStep.linkPath ?? "procedimento"}` } : null}
          />
        ) : null}
      </div>
    </header>
  );
}
