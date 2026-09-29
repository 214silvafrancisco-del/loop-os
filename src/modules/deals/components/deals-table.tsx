import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatPercent } from "@/core/lib/format";
import { PropertyRef } from "@/modules/properties/components/property-badges";
import type { DealListRow } from "../queries";
import { dealRef } from "../utils";
import { DealStatusBadge, StageBadge } from "./deal-badges";
import { NextActionEditor } from "./next-action-editor";

export { dealRef };

export function DealsTable({ deals }: { deals: DealListRow[] }) {
  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Sem negócios para mostrar.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Ref</TableHead>
            <TableHead>Negócio</TableHead>
            <TableHead className="hidden md:table-cell">Tipologia</TableHead>
            <TableHead className="text-right">Preço pedido</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead className="hidden lg:table-cell">Próxima ação</TableHead>
            <TableHead className="hidden xl:table-cell">Fonte</TableHead>
            <TableHead className="hidden xl:table-cell text-right">ROE</TableHead>
            <TableHead className="hidden lg:table-cell">Responsável</TableHead>
            <TableHead className="hidden xl:table-cell">Entrada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((d) => (
            <TableRow key={d.id} className={d.status === "excluded" ? "opacity-60" : undefined}>
              <TableCell>
                <PropertyRef value={dealRef(d)} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
                    {d.name ?? d.addressLine}
                  </Link>
                  <DealStatusBadge status={d.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {d.addressLine}
                  {d.parish ? ` · ${d.parish}` : ""}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {d.typology ?? "—"}
                {d.floor ? <span className="text-xs text-muted-foreground"> · {/^\d+$/.test(d.floor) ? `${d.floor}.º` : d.floor}</span> : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(d.askingPrice)}</TableCell>
              <TableCell>
                <StageBadge name={d.stageName} color={d.stageColor} />
              </TableCell>
              <TableCell className="hidden lg:table-cell max-w-56">
                <NextActionEditor dealId={d.id} action={d.nextAction} date={d.nextActionDate} compact />
              </TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">
                {d.sourceName ?? "—"}
                {d.contactName ? <div className="text-xs">{d.contactName}</div> : null}
              </TableCell>
              <TableCell className="hidden xl:table-cell text-right tabular-nums">
                {d.bpRoe ? formatPercent(d.bpRoe) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">{d.ownerName ?? "—"}</TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">{formatDate(d.enteredAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
