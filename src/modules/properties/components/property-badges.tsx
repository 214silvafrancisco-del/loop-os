import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Property } from "../schema";
import { PROPERTY_STATUS_LABEL, PROPERTY_TYPE_LABEL } from "../validation";

const STATUS_CLASS: Record<Property["status"], string> = {
  prospect: "bg-muted text-muted-foreground",
  owned: "bg-primary/15 text-primary",
  for_sale: "bg-warning/20 text-foreground",
  sold: "bg-success/15 text-success",
};

export function PropertyStatusBadge({ status }: { status: Property["status"] }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", STATUS_CLASS[status])}>
      {PROPERTY_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PropertyRef({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("font-mono text-xs font-semibold tracking-wide text-muted-foreground", className)}>
      {value}
    </span>
  );
}

export function PropertyTypeLabel({ type }: { type: Property["propertyType"] }) {
  return <>{PROPERTY_TYPE_LABEL[type]}</>;
}

/** "T2 · 85 m² · 1.º" para cabeçalhos e listas. */
export function propertySummary(p: Property): string {
  const parts = [
    p.typology,
    p.grossArea ? `${Number(p.grossArea).toLocaleString("pt-PT")} m²` : null,
    p.floor ? (/^\d+$/.test(p.floor) ? `${p.floor}.º` : p.floor) : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
