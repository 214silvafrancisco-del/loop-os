"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/core/lib/format";
import type { DealListRow } from "../queries";
import { dealRef, floorLabel } from "../utils";
import { NextActionEditor } from "./next-action-editor";

function initials(name: string | null) {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function KanbanCardBody({ deal, dragging }: { deal: DealListRow; dragging?: boolean }) {
  const place = deal.parish ?? deal.municipality;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm shadow-xs",
        dragging && "rotate-1 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">{dealRef(deal)}</div>
          <Link href={`/deals/${deal.id}`} className="block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {deal.name ?? deal.addressLine}
          </Link>
          <div className="truncate text-xs text-muted-foreground">
            {[deal.typology, floorLabel(deal.floor), place].filter(Boolean).join(" · ")}
          </div>
        </div>
        {deal.ownerName ? (
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
            title={deal.ownerName}
          >
            {initials(deal.ownerName)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{formatCurrency(deal.askingPrice)}</span>
        {deal.sourceName ? <span className="text-muted-foreground">{deal.sourceName}</span> : null}
      </div>
      <NextActionEditor dealId={deal.id} action={deal.nextAction} date={deal.nextActionDate} compact />
    </div>
  );
}

export function KanbanCard({ deal }: { deal: DealListRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { stageId: deal.stageId },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")}
      {...listeners}
      {...attributes}
    >
      <KanbanCardBody deal={deal} />
    </div>
  );
}
