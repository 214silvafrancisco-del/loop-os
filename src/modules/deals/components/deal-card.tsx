import Link from "next/link";
import { formatCurrency } from "@/core/lib/format";
import { cn } from "@/lib/utils";
import { ChecklistMini } from "@/modules/checklists/components/checklist-mini";
import type { DealListRow } from "../queries";
import { dealRef, floorLabel } from "../utils";
import { DealStatusBadge, StageBadge } from "./deal-badges";
import { NextActionEditor } from "./next-action-editor";

/** Cartão de negócio para ecrãs pequenos: o que a tabela esconde no telemóvel fica aqui à vista. */
export function DealCard({ deal }: { deal: DealListRow }) {
  const place = deal.parish ?? deal.municipality;
  const facts = [deal.typology, floorLabel(deal.floor), deal.propertyType !== "apartamento" ? deal.propertyType : null].filter(Boolean).join(" · ");
  return (
    <article className={cn("flex flex-col gap-2 rounded-xl border bg-card p-3", deal.status === "excluded" && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">{dealRef(deal)}</span>
            <StageBadge name={deal.stageName} color={deal.stageColor} />
            <DealStatusBadge status={deal.status} />
          </div>
          <Link href={`/deals/${deal.id}`} className="mt-0.5 block truncate text-base font-medium hover:underline">
            {deal.name ?? deal.addressLine}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {deal.addressLine}
            {place ? ` · ${place}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-right text-base font-semibold tabular-nums">{formatCurrency(deal.askingPrice)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{facts || "—"}</span>
        <ChecklistMini done={deal.checklistDone} total={deal.checklistTotal} requiredMissing={deal.requiredMissing} href={`/deals/${deal.id}/processo`} />
      </div>
      <NextActionEditor dealId={deal.id} action={deal.nextAction} date={deal.nextActionDate} compact />
      {deal.ownerName || deal.sourceName ? (
        <p className="text-xs text-muted-foreground">
          {[deal.ownerName, deal.sourceName].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </article>
  );
}
