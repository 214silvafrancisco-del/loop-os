"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/core/lib/format";
import { floorLabel } from "@/modules/deals/utils";
import type { SaleListRow } from "../queries";
import { SaleStageBadge } from "./sale-badges";
import { SaleNextAction } from "./sale-next-action";

function initials(name: string | null) {
  return (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

/** Corpo do cartão (Kanban e lista em telemóvel). */
export function SaleCardBody({ sale, dragging, showStage }: { sale: SaleListRow; dragging?: boolean; showStage?: boolean }) {
  const place = sale.parish ?? sale.municipality;
  const price = sale.salePrice ?? sale.listingPrice;
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm shadow-xs", dragging && "rotate-1 shadow-lg")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">{sale.ref}</span>
            {showStage ? <SaleStageBadge stage={sale.stage} /> : null}
          </div>
          <Link href={`/sales/${sale.id}`} className="block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {sale.dealName ?? sale.addressLine}
          </Link>
          <div className="truncate text-xs text-muted-foreground">{[sale.typology, floorLabel(sale.floor), place].filter(Boolean).join(" · ")}</div>
        </div>
        {sale.ownerName ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary" title={sale.ownerName}>
            {initials(sale.ownerName)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{price ? formatCurrency(price) : "sem preço"}</span>
        <span className="flex items-center gap-1 text-muted-foreground" title="Leads em aberto / total">
          <Users className="size-3.5" />
          {sale.leadsOpen}/{sale.leadsTotal}
        </span>
      </div>
      {sale.agencies ? <p className="truncate text-xs text-muted-foreground">{sale.agencies}</p> : null}
      <SaleNextAction saleId={sale.id} action={sale.nextAction} date={sale.nextActionDate} compact />
    </div>
  );
}
