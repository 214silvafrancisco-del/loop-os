import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/core/lib/format";
import { StageBadge } from "@/modules/deals/components/deal-badges";
import { NextActionEditor } from "@/modules/deals/components/next-action-editor";
import type { DealListRow } from "@/modules/deals/queries";
import { dealRef, isOverdue, todayIso } from "@/modules/deals/utils";

/** Lista de próximas ações do dashboard: atrasadas, hoje, esta semana. */
export function ActionsList({ deals }: { deals: DealListRow[] }) {
  if (deals.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Nada agendado para esta semana.
      </p>
    );
  }
  const today = todayIso();
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {deals.map((d) => {
        const overdue = isOverdue(d.nextActionDate);
        const isToday = d.nextActionDate === today;
        return (
          <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                overdue ? "bg-destructive" : isToday ? "bg-primary" : "bg-muted-foreground/40",
              )}
              title={overdue ? "Atrasada" : isToday ? "Hoje" : "Esta semana"}
            />
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">{dealRef(d)}</span>
            <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
              {d.name ?? d.addressLine}
            </Link>
            <StageBadge name={d.stageName} color={d.stageColor} className="hidden sm:inline-flex" />
            <span className="hidden text-xs text-muted-foreground md:inline">{formatCurrency(d.askingPrice)}</span>
            <div className="w-full sm:ml-auto sm:w-72">
              <NextActionEditor dealId={d.id} action={d.nextAction} date={d.nextActionDate} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
