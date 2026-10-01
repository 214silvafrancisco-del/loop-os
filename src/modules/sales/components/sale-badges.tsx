import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABEL, SALE_STAGE_COLOR, SALE_STAGE_LABEL } from "../constants";
import type { LeadStatus, SaleStage } from "../schema";

export function SaleStageBadge({ stage, className }: { stage: SaleStage; className?: string }) {
  const color = SALE_STAGE_COLOR[stage];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)} style={{ borderColor: color, color }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {SALE_STAGE_LABEL[stage]}
    </Badge>
  );
}

const LEAD_COLOR: Record<LeadStatus, string> = {
  novo: "bg-muted text-foreground",
  visita_marcada: "bg-blue-500/10 text-blue-700",
  visitou: "bg-blue-500/15 text-blue-800",
  proposta: "bg-amber-500/15 text-amber-800",
  ganho: "bg-green-500/15 text-green-800",
  perdido: "bg-muted text-muted-foreground line-through",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", LEAD_COLOR[status])}>
      {LEAD_STATUS_LABEL[status]}
    </Badge>
  );
}
