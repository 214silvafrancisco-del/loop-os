"use client";

import { Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney, formatPercent } from "@/core/lib/format";
import { createMeasurement } from "../measurements/actions";
import { monthLabel } from "../measurements/calc";
import type { MeasurementRow } from "../measurements/queries";

type SupplierInfo = { id: string; name: string; controlMode: "autos" | "fatura"; budgeted: number };
type Props = { projectId: string; suppliers: SupplierInfo[]; measurements: MeasurementRow[] };

/** Autos de medição agrupados por fornecedor: um auto por mês por fornecedor. */
export function MeasurementsList({ projectId, suppliers, measurements }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function create(supplierId: string) {
    setError(null);
    startTransition(async () => {
      const r = await createMeasurement(projectId, supplierId);
      if (r && !r.ok) setError(r.error);
    });
  }

  if (suppliers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Ainda não há fornecedores nesta obra. Adiciona-os na tab Orçamento; cada fornecedor por autos tem aqui os seus autos mensais.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Um auto por mês por fornecedor: escreve a percentagem acumulada de cada artigo; a app calcula o executado. Fechado é imutável.
        </p>
        {error ? <span className="ml-auto text-xs text-destructive">{error}</span> : null}
      </div>

      {suppliers.map((s) => {
        const mine = measurements.filter((m) => m.projectSupplierId === s.id);
        const hasDraft = mine.some((m) => m.status === "draft");
        const byAutos = s.controlMode === "autos";
        return (
          <section key={s.id} className="rounded-xl border bg-card">
            <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <h3 className="text-sm font-semibold">{s.name}</h3>
              <span className={cn("rounded px-1.5 text-[11px]", byAutos ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{byAutos ? "autos mensais" : "por fatura"}</span>
              <span className="text-xs tabular-nums text-muted-foreground">orçamentado {formatMoney(s.budgeted)}</span>
              {byAutos ? (
                <Button
                  size="sm"
                  className="ml-auto gap-1"
                  onClick={() => create(s.id)}
                  disabled={pending || hasDraft || s.budgeted <= 0}
                  title={hasDraft ? "Fecha o rascunho primeiro" : s.budgeted <= 0 ? "Este fornecedor não tem orçamento" : undefined}
                >
                  <Plus className="size-4" /> {pending ? "…" : "Novo auto"}
                </Button>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground">Sem autos: as faturas comparam-se com o orçamentado.</span>
              )}
            </header>
            {!byAutos ? null : mine.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted-foreground">Ainda sem autos.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">N.º</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="hidden md:table-cell">Data</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Neste auto</TableHead>
                    <TableHead className="text-right">Acumulado</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mine.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.number}</TableCell>
                      <TableCell>
                        <Link href={`/projects/${projectId}/autos/${m.id}`} className="font-medium hover:underline">{monthLabel(m.periodMonth)}</Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(m.reportDate)}</TableCell>
                      <TableCell>
                        {m.status === "closed" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success"><Lock className="size-3" /> Fechado</span>
                        ) : (
                          <span className="rounded-md bg-warning/20 px-2 py-0.5 text-xs font-medium">Rascunho</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(m.totalPeriod)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(m.totalCumulative)}</TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">{s.budgeted ? formatPercent(Number(m.totalCumulative) / s.budgeted) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        );
      })}
    </div>
  );
}
