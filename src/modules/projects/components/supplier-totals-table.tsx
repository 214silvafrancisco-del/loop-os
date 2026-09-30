import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/core/lib/format";
import { monthLabel } from "../measurements/calc";
import type { SupplierFinancials } from "../invoices/queries";

/** Orçamentado / Executado / Faturado / Desvio / Pago por fornecedor da obra. */
export function SupplierTotalsTable({ rows }: { rows: SupplierFinancials[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card">
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
  );
}
