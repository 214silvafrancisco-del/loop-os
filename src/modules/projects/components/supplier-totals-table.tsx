import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/core/lib/format";
import { monthLabel } from "../measurements/calc";
import type { SupplierFinancials } from "../invoices/queries";

/** Orçamentado / Executado / Faturado / Desvio / Pago por fornecedor da obra. */
export function SupplierTotalsTable({ rows }: { rows: SupplierFinancials[] }) {
  if (rows.length === 0) return null;
  return (
    <>
    <ul className="flex flex-col gap-2 md:hidden">
      {rows.map((s) => {
        const dev = s.invoicedNet - s.budgeted;
        return (
          <li key={s.supplierId} className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{s.supplierName}</span>
              <span className="text-[11px] text-muted-foreground">{s.controlMode === "autos" ? "autos mensais" : "por fatura"}</span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Orçamentado</dt><dd className="text-right tabular-nums">{formatMoney(s.budgeted)}</dd>
              {s.controlMode === "autos" ? (<><dt className="text-muted-foreground">Executado</dt><dd className="text-right tabular-nums">{formatMoney(s.executed)}{s.budgeted ? <span className="ml-1 text-xs text-muted-foreground">{formatPercent(s.executed / s.budgeted)}</span> : null}</dd></>) : null}
              <dt className="text-muted-foreground">Faturado s/ IVA</dt><dd className="text-right tabular-nums">{formatMoney(s.invoicedNet)}</dd>
              <dt className="text-muted-foreground">Desvio</dt><dd className={cn("text-right tabular-nums", dev > 0 && "text-destructive")}>{dev > 0 ? "+" : ""}{formatMoney(dev)}</dd>
              <dt className="text-muted-foreground">Pago</dt><dd className="text-right tabular-nums">{formatMoney(s.paid)}</dd>
            </dl>
          </li>
        );
      })}
    </ul>
    <div className="hidden rounded-xl border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fornecedor</TableHead>
            <TableHead className="hidden md:table-cell">Controlo</TableHead>
            <TableHead className="text-right">Orçamentado</TableHead>
            <TableHead className="text-right">Executado</TableHead>
            <TableHead className="text-right">Faturado s/ IVA</TableHead>
            <TableHead className="text-right">Desvio</TableHead>
            <TableHead className="text-right">Pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const dev = s.invoicedNet - s.budgeted;
            const aheadOfExecution = s.controlMode === "autos" && s.executed > 0 && s.invoicedNet > s.executed + 0.5;
            return (
              <TableRow key={s.supplierId}>
                <TableCell className="font-medium">{s.supplierName}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{s.controlMode === "autos" ? "autos mensais" : "por fatura"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(s.budgeted)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.controlMode === "autos" ? (
                    <>
                      {formatMoney(s.executed)}
                      {s.budgeted ? <span className="ml-1 text-xs text-muted-foreground">{formatPercent(s.executed / s.budgeted)}</span> : null}
                      {s.lastMeasurement ? <div className="text-[11px] text-muted-foreground">auto {s.lastMeasurement.number} · {monthLabel(s.lastMeasurement.month)}</div> : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", aheadOfExecution && "text-warning")} title={aheadOfExecution ? "Faturado acima do executado" : undefined}>{formatMoney(s.invoicedNet)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", dev > 0 && "text-destructive")}>{dev > 0 ? "+" : ""}{formatMoney(dev)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(s.paid)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    </>
  );
}
