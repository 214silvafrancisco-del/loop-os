"use client";

import { Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney, formatPercent } from "@/core/lib/format";
import { createMeasurement } from "../measurements/actions";
import { monthLabel } from "../measurements/calc";
import type { MeasurementRow } from "../measurements/queries";

type Props = { projectId: string; measurements: MeasurementRow[]; budgetTotal: number };

export function MeasurementsList({ projectId, measurements, budgetTotal }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasDraft = measurements.some((m) => m.status === "draft");

  function create() {
    setError(null);
    startTransition(async () => {
      const r = await createMeasurement(projectId);
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Um auto por mês: escreve a percentagem acumulada de cada artigo; a app calcula o executado. Fechado é imutável.
        </p>
        <span className="ml-auto flex items-center gap-2">
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
          <Button size="sm" className="gap-1" onClick={create} disabled={pending || hasDraft || budgetTotal <= 0} title={hasDraft ? "Fecha o rascunho primeiro" : budgetTotal <= 0 ? "O orçamento está vazio" : undefined}>
            <Plus className="size-4" /> {pending ? "…" : "Novo auto"}
          </Button>
        </span>
      </div>

      {measurements.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Ainda sem autos de medição.</p>
      ) : (
        <div className="rounded-xl border bg-card">
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
              {measurements.map((m) => (
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
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">{budgetTotal ? formatPercent(Number(m.totalCumulative) / budgetTotal) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
