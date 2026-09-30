"use client";

import { CreditCard, FileText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney, formatPercent } from "@/core/lib/format";
import { deleteInvoice } from "../invoices/actions";
import type { InvoiceRow, InvoiceStatus, ProjectFinancials } from "../invoices/queries";
import type { Payment } from "../schema";
import { InvoiceDialog, type MeasurementOption, type SupplierOption } from "./invoice-dialog";
import { PaymentDialog } from "./payment-dialog";
import { SupplierTotalsTable } from "./supplier-totals-table";

type Props = {
  projectId: string;
  propertyId: string;
  invoices: InvoiceRow[];
  paymentsByInvoice: Record<string, Payment[]>;
  fin: ProjectFinancials;
  suppliers: SupplierOption[];
  measurements: MeasurementOption[];
  invoiceCategoryId: string | null;
  canDelete: boolean;
};

const STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  unpaid: { label: "Por pagar", cls: "bg-muted text-foreground" },
  partial: { label: "Parcial", cls: "bg-warning/20 text-foreground" },
  paid: { label: "Pago", cls: "bg-success/15 text-success" },
  overdue: { label: "Em atraso", cls: "bg-destructive/10 text-destructive" },
};

export function InvoicesPanel({ projectId, propertyId, invoices, paymentsByInvoice, fin, suppliers, measurements, invoiceCategoryId, canDelete }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; invoice: InvoiceRow } | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const openDialog = (d: { mode: "create" } | { mode: "edit"; invoice: InvoiceRow }) => {
    setDialogKey((k) => k + 1);
    setDialog(d);
  };
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove(inv: InvoiceRow) {
    if (!confirm(`Eliminar a fatura ${inv.number} de ${inv.supplierName}?`)) return;
    startTransition(async () => {
      const r = await deleteInvoice(inv.id);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  const deviation = fin.invoicedNet - fin.budgeted;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Orçamentado" value={formatMoney(fin.budgeted)} />
        <Stat label="Executado" value={formatMoney(fin.executed)} hint={fin.budgeted ? formatPercent(fin.executed / fin.budgeted) : undefined} />
        <Stat label="Faturado s/ IVA" value={formatMoney(fin.invoicedNet)} hint={`c/ IVA ${formatMoney(fin.invoicedGross)}`} tone={fin.executed > 0 && fin.invoicedNet > fin.executed ? "warn" : undefined} />
        <Stat label="Pago" value={formatMoney(fin.paid)} />
        <Stat label="Por pagar" value={formatMoney(fin.unpaid)} hint={fin.overdueCount ? `${fin.overdueCount} em atraso` : undefined} tone={fin.overdueCount ? "bad" : fin.unpaid > 0 ? "warn" : undefined} />
        <Stat label="Desvio" value={`${deviation > 0 ? "+" : ""}${formatMoney(deviation)}`} hint="faturado − orçamentado" tone={deviation > 0 ? "bad" : undefined} />
      </div>

      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Faturas</h3>
        <span className="ml-auto flex items-center gap-2">
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
          <Button size="sm" className="gap-1" onClick={() => openDialog({ mode: "create" })} disabled={suppliers.length === 0} title={suppliers.length === 0 ? "Adiciona fornecedores na tab Orçamento" : undefined}><Plus className="size-4" /> Nova fatura</Button>
        </span>
      </div>

      {invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Ainda sem faturas.</p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N.º</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                <TableHead className="text-right">S/ IVA</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Total</TableHead>
                <TableHead className="text-right">Por pagar</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Auto</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const st = STATUS[inv.status];
                const unpaid = Number(inv.total) - inv.paidAmount;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{inv.supplierName}</div>
                      {inv.description ? <div className="text-xs text-muted-foreground">{inv.description}</div> : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell className={cn("hidden md:table-cell", inv.status === "overdue" ? "font-medium text-destructive" : "text-muted-foreground")}>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(inv.netAmount)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right tabular-nums">{formatMoney(inv.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{unpaid > 0.005 ? formatMoney(unpaid) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", st.cls)}>{st.label}</span></TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{inv.measurementNumber ? `n.º ${inv.measurementNumber}` : "—"}</TableCell>
                    <TableCell>
                      <span className="flex justify-end gap-0.5">
                        {inv.versionId ? (
                          <Button asChild variant="ghost" size="icon" className="size-8" title="PDF">
                            <a href={`/api/documents/${inv.versionId}/download?inline=1`} target="_blank" rel="noreferrer"><FileText className="size-4" /></a>
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon" className="size-8" title="Pagamentos" onClick={() => setPaying(inv)}><CreditCard className="size-4" /></Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded-md p-1.5 hover:bg-accent" aria-label="Mais"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDialog({ mode: "edit", invoice: inv })}><Pencil className="size-4" /> Editar</DropdownMenuItem>
                            {canDelete ? (<><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => remove(inv)}><Trash2 className="size-4" /> Eliminar</DropdownMenuItem></>) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {fin.bySupplier.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Por fornecedor</h3>
          <SupplierTotalsTable rows={fin.bySupplier} />
        </div>
      ) : null}

      <InvoiceDialog
        key={dialogKey}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        projectId={projectId}
        propertyId={propertyId}
        suppliers={suppliers}
        measurements={measurements}
        invoice={dialog?.mode === "edit" ? dialog.invoice : null}
        invoiceCategoryId={invoiceCategoryId}
      />
      <PaymentDialog invoice={paying} payments={paying ? (paymentsByInvoice[paying.id] ?? []) : []} onClose={() => setPaying(null)} />
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", tone === "bad" && "text-destructive", tone === "warn" && "text-warning")}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
