"use client";

import { ChevronDown, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney, formatPercent } from "@/core/lib/format";
import { createMeasurement } from "../measurements/actions";
import { workInvoiceNet } from "../measurements/advance";
import { monthLabel } from "../measurements/calc";
import type { MeasurementRow } from "../measurements/queries";
import { AdvanceAutoDialog } from "./advance-auto-dialog";

type SupplierInfo = { id: string; name: string; controlMode: "autos" | "fatura"; budgeted: number; advancePct: number };
type Props = { projectId: string; propertyId: string; suppliers: SupplierInfo[]; measurements: MeasurementRow[]; documentCategoryId: string | null };

const pctLabel = (p: number) => `${Math.round(p * 10000) / 100} %`;

/** Autos por fornecedor: auto de adiantamento (fatura de adiantamento) e autos de trabalho (um por mês). */
export function MeasurementsList({ projectId, propertyId, suppliers, measurements, documentCategoryId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [advanceFor, setAdvanceFor] = useState<SupplierInfo | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const nextNumber = measurements.reduce((m, r) => Math.max(m, r.number), -1) + 1;

  function createWork(supplierId: string) {
    setError(null);
    startTransition(async () => {
      const r = await createMeasurement(projectId, supplierId);
      if (r && !r.ok) setError(r.error);
    });
  }
  function openAdvance(s: SupplierInfo) {
    setDialogKey((k) => k + 1);
    setAdvanceFor(s);
  }

  if (suppliers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Ainda não há fornecedores nesta obra. Adiciona-os na tab Orçamento; cada fornecedor por autos tem aqui os seus autos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Auto de adiantamento = fatura de adiantamento, com a percentagem a descontar. Auto de trabalho = trabalho executado no mês; a fatura correspondente é o auto × (1 − % adiantamento).
        </p>
        {error ? <span className="ml-auto text-xs text-destructive">{error}</span> : null}
      </div>

      {suppliers.map((s) => {
        const mine = measurements.filter((m) => m.projectSupplierId === s.id);
        const advances = mine.filter((m) => m.kind === "adiantamento");
        const works = mine.filter((m) => m.kind === "trabalho");
        const hasDraft = works.some((m) => m.status === "draft");
        const byAutos = s.controlMode === "autos";
        return (
          <section key={s.id} className="rounded-xl border bg-card">
            <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <h3 className="text-sm font-semibold">{s.name}</h3>
              <span className={cn("rounded px-1.5 text-[11px]", byAutos ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{byAutos ? "autos mensais" : "por fatura"}</span>
              <span className="text-xs tabular-nums text-muted-foreground">adjudicado {formatMoney(s.budgeted)}</span>
              {s.advancePct > 0 ? <span className="rounded bg-warning/20 px-1.5 text-[11px] font-medium">adiantamento {pctLabel(s.advancePct)}</span> : null}
              {byAutos ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="ml-auto gap-1" disabled={pending}>
                      <Plus className="size-4" /> {pending ? "…" : "Novo auto"} <ChevronDown className="size-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => createWork(s.id)} disabled={hasDraft || s.budgeted <= 0}>
                      Auto de trabalho{hasDraft ? " (fecha o rascunho primeiro)" : s.budgeted <= 0 ? " (sem orçamento)" : ""}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openAdvance(s)}>Auto de adiantamento</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground">Sem autos: as faturas comparam-se com o orçamentado.</span>
              )}
            </header>

            {!byAutos ? null : (
              <>
                {advances.length ? (
                  <div className="border-b">
                    <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Auto de adiantamento</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="w-16">N.º</TableHead>
                          <TableHead className="hidden md:table-cell">Data</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">Fatura</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {advances.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>
                              <Link href={`/projects/${projectId}/autos/${m.id}`} className="rounded bg-warning/20 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide hover:underline">
                                Adiantamento
                              </Link>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{m.number}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(m.reportDate)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(m.totalPeriod)}</TableCell>
                            <TableCell className="text-right tabular-nums">{pctLabel(Number(m.advancePct ?? 0))}</TableCell>
                            <TableCell className="text-right tabular-nums">{m.invoicedNet === null ? <span className="text-muted-foreground">por faturar</span> : formatMoney(m.invoicedNet)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                {works.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">Ainda sem autos de trabalho.</p>
                ) : (
                  <div>
                    <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Autos de trabalho</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="w-16">N.º</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Trabalho executado</TableHead>
                          <TableHead className="hidden md:table-cell text-right">Acumulado</TableHead>
                          <TableHead className="text-right">Fatura</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {works.map((m) => {
                          const expected = workInvoiceNet(Number(m.totalPeriod), s.advancePct);
                          return (
                            <TableRow key={m.id}>
                              <TableCell className="text-xs font-medium">Trabalho</TableCell>
                              <TableCell className="font-mono text-xs">{m.number}</TableCell>
                              <TableCell>
                                <Link href={`/projects/${projectId}/autos/${m.id}`} className="font-medium hover:underline">{monthLabel(m.periodMonth)}</Link>
                              </TableCell>
                              <TableCell>
                                {m.status === "closed" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success"><Lock className="size-3" /> Fechado</span>
                                ) : (
                                  <span className="rounded-md bg-warning/20 px-2 py-0.5 text-xs font-medium">Rascunho</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{formatMoney(m.totalPeriod)}</TableCell>
                              <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                                {formatMoney(m.totalCumulative)}
                                {s.budgeted ? <span className="ml-1 text-xs">{formatPercent(Number(m.totalCumulative) / s.budgeted)}</span> : null}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {m.invoicedNet !== null ? (
                                  formatMoney(m.invoicedNet)
                                ) : m.status === "closed" ? (
                                  <span className="text-muted-foreground" title={s.advancePct > 0 ? `${formatMoney(m.totalPeriod)} × (1 − ${pctLabel(s.advancePct)})` : "igual ao auto"}>
                                    {formatMoney(expected)} <span className="text-xs">prev.</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      {advanceFor ? (
        <AdvanceAutoDialog
          key={dialogKey}
          open
          onClose={() => setAdvanceFor(null)}
          projectId={projectId}
          propertyId={propertyId}
          supplier={advanceFor}
          nextNumber={nextNumber}
          documentCategoryId={documentCategoryId}
        />
      ) : null}
    </div>
  );
}
