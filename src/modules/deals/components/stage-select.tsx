"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { DealStage } from "@/modules/settings/queries";
import { changeDealStage } from "../actions";
import { PurchaseDialog } from "./purchase-dialog";

type Props = {
  dealId: string;
  dealLabel: string;
  stageId: string;
  stages: DealStage[];
  askingPrice?: string | null;
  disabled?: boolean;
};

/** Badge de fase clicável: um select com a cor da fase. Compra abre o diálogo. */
export function StageSelect({ dealId, dealLabel, stageId, stages, askingPrice, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const current = stages.find((s) => s.id === stageId);

  function change(nextStageId: string) {
    if (nextStageId === stageId) return;
    startTransition(async () => {
      const result = await changeDealStage(dealId, nextStageId);
      if (result.ok) router.refresh();
      else if ("needsPurchase" in result) setPendingStage(nextStageId);
      else alert(result.error);
    });
  }

  return (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
          pending && "opacity-60",
        )}
        style={current?.color ? { borderColor: current.color, color: current.color } : undefined}
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: current?.color ?? "currentColor" }} />
        <select
          aria-label="Fase"
          value={stageId}
          disabled={disabled || pending}
          onChange={(e) => change(e.target.value)}
          className="cursor-pointer bg-transparent pr-1 text-xs font-medium outline-none"
          style={current?.color ? { color: current.color } : undefined}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id} className="text-foreground">
              {s.name}
            </option>
          ))}
        </select>
      </span>
      {pendingStage ? (
        <PurchaseDialog
          open
          dealLabel={dealLabel}
          askingPrice={askingPrice}
          onCancel={() => setPendingStage(null)}
          onConfirm={async (input) => {
            const result = await changeDealStage(dealId, pendingStage, input);
            if (result.ok) {
              setPendingStage(null);
              router.refresh();
              return null;
            }
            return "error" in result ? result.error : "Falta o valor final ou a data da escritura.";
          }}
        />
      ) : null}
    </>
  );
}
