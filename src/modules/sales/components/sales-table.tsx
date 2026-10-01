import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { todayIso } from "@/core/lib/dates";
import { NextAction } from "@/modules/deals/components/deal-badges";
import { PropertyRef } from "@/modules/properties/components/property-badges";
import { daysOnMarket } from "../constants";
import type { SaleListRow } from "../queries";
import { SaleStageBadge } from "./sale-badges";
import { SaleCardBody } from "./sale-card";

/** Lista de vendas: tabela em desktop, cartões em telemóvel. */
export function SalesTable({ sales }: { sales: SaleListRow[] }) {
  const today = todayIso();
  if (sales.length === 0) {
    return <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Sem vendas. Começa pelo botão «Colocar à venda» num negócio comprado, ou «Nova venda» aqui.</p>;
  }
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {sales.map((s) => (
          <SaleCardBody key={s.id} sale={s} showStage />
        ))}
      </div>
      <div className="hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref.</TableHead>
              <TableHead>Imóvel</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Dias</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead>Mediadoras</TableHead>
              <TableHead>Próxima ação</TableHead>
              <TableHead>Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s) => {
              const days = daysOnMarket(s.listingDate, s.deedDate, today);
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <PropertyRef value={s.ref} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/sales/${s.id}`} className="font-medium hover:underline">
                      {s.dealName ?? s.addressLine}
                    </Link>
                    <div className="text-xs text-muted-foreground">{[s.typology, s.parish ?? s.municipality].filter(Boolean).join(" · ")}</div>
                  </TableCell>
                  <TableCell>
                    <SaleStageBadge stage={s.stage} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.salePrice ? (
                      <>
                        {formatCurrency(s.salePrice)}
                        <div className="text-[11px] text-muted-foreground">escritura {formatDate(s.deedDate)}</div>
                      </>
                    ) : s.listingPrice ? (
                      formatCurrency(s.listingPrice)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{days ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.leadsOpen}
                    <span className="text-muted-foreground">/{s.leadsTotal}</span>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground">{s.agencies ?? "—"}</TableCell>
                  <TableCell className="max-w-56 text-xs">
                    <NextAction action={s.nextAction} date={s.nextActionDate} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.ownerName ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
