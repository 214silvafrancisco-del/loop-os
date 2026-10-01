"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addScenario } from "../actions";
import type { CalcContext, ScenarioInputs } from "../calc";
import { ScenarioColumn } from "./scenario-column";

export type ScenarioView = {
  id: string;
  name: string;
  kind: "ato_continuo" | "remodelacao" | "custom";
  isActive: boolean;
  inputs: ScenarioInputs;
};

type Props = {
  businessPlanId: string;
  dealId: string;
  scenarios: ScenarioView[];
  ctx: CalcContext;
  targetRoe: number;
  imtYear: number | null;
};

export function ScenarioBoard({ businessPlanId, dealId, scenarios, ctx, targetRoe, imtYear }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Telemóvel: um cenário de cada vez (o ativo por defeito).
  const [selectedId, setSelectedId] = useState(() => (scenarios.find((s) => s.isActive) ?? scenarios[0])?.id ?? "");
  const selected = scenarios.find((s) => s.id === selectedId) ?? scenarios.find((s) => s.isActive) ?? scenarios[0];

  function add() {
    const name = prompt("Nome do novo cenário (copia o cenário ativo)", "Downside");
    if (!name) return;
    const source = scenarios.find((s) => s.isActive) ?? scenarios[0];
    startTransition(async () => {
      const r = await addScenario(businessPlanId, name, source?.id);
      if (!r.ok) return setError(r.error);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Cenários lado a lado. O cenário <span className="font-medium text-foreground">ativo</span> alimenta a lista, o Kanban e o dashboard.
        </span>
        <span>Tabelas de IMT {imtYear ?? "—"}.</span>
        <Button size="sm" variant="outline" className="ml-auto gap-1" onClick={add} disabled={pending}>
          <Plus className="size-4" />
          Novo cenário
        </Button>
      </div>
      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}

      {/* Telemóvel: seletor de cenário + coluna a toda a largura */}
      <div className="md:hidden">
        {scenarios.length > 1 ? (
          <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1 [scrollbar-width:none]">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={cn("min-h-10 shrink-0 rounded-md px-3 text-sm font-medium", s.id === selected?.id ? "bg-card shadow-xs" : "text-muted-foreground")}
              >
                {s.name}{s.isActive ? " ★" : ""}
              </button>
            ))}
          </div>
        ) : null}
        {selected ? (
          <ScenarioColumn
            key={selected.id}
            scenarioId={selected.id}
            dealId={dealId}
            name={selected.name}
            kind={selected.kind}
            isActive={selected.isActive}
            initialInputs={selected.inputs}
            ctx={ctx}
            targetRoe={targetRoe}
            canDelete={scenarios.length > 1}
            fullWidth
          />
        ) : null}
      </div>

      <div className="hidden gap-4 overflow-x-auto pb-4 md:flex">
        {scenarios.map((s) => (
          <ScenarioColumn
            key={s.id}
            scenarioId={s.id}
            dealId={dealId}
            name={s.name}
            kind={s.kind}
            isActive={s.isActive}
            initialInputs={s.inputs}
            ctx={ctx}
            targetRoe={targetRoe}
            canDelete={scenarios.length > 1}
          />
        ))}
      </div>
    </div>
  );
}
