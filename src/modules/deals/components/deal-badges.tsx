import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/core/lib/format";

/** Fase com a cor definida em Definições. */
export function StageBadge({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", className)}
      style={color ? { borderColor: color, color } : undefined}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color ?? "currentColor" }} />
      {name}
    </Badge>
  );
}

export function DealStatusBadge({ status }: { status: "active" | "excluded" | "sold" }) {
  if (status === "active") return null;
  if (status === "sold") {
    return (
      <Badge variant="secondary" className="bg-green-500/15 text-green-800">
        Vendido
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      Excluído
    </Badge>
  );
}

function isOverdue(date: string) {
  return new Date(date).getTime() < new Date(new Date().toDateString()).getTime();
}

/** Próxima ação com data; a vermelho se já passou. */
export function NextAction({ action, date }: { action: string | null; date: string | null }) {
  if (!action && !date) return <span className="text-muted-foreground">—</span>;
  const overdue = date ? isOverdue(date) : false;
  return (
    <div className="flex flex-col">
      {action ? <span className="truncate">{action}</span> : null}
      {date ? (
        <span className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
          {formatDate(date)}
          {overdue ? " · atrasada" : ""}
        </span>
      ) : null}
    </div>
  );
}
