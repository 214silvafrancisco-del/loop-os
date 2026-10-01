"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { changeSaleStage } from "../actions";
import { SALE_STAGES, SALE_STAGE_COLOR } from "../constants";
import type { SaleStage } from "../schema";
import { CloseSaleDialog } from "./close-sale-dialog";

type Props = { saleId: string; label: string; stage: SaleStage; salePrice?: string | null; deedDate?: string | null };

/** Badge de fase clicável. «Vendido» abre o diálogo de fecho. */
export function SaleStageSelect({ saleId, label, stage, salePrice, deedDate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);
  const color = SALE_STAGE_COLOR[stage];

  function change(next: SaleStage) {
    if (next === stage) return;
    startTransition(async () => {
      const r = await changeSaleStage(saleId, next);
      if (r.ok) router.refresh();
      else if ("needsClose" in r) setClosing(true);
      else alert(r.error);
    });
  }

  return (
    <>
      <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", pending && "opacity-60")} style={{ borderColor: color, color }}>
        <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
        <select aria-label="Fase da venda" value={stage} disabled={pending} onChange={(e) => change(e.target.value as SaleStage)} className="cursor-pointer bg-transparent pr-1 text-xs font-medium outline-none" style={{ color }}>
          {SALE_STAGES.map((s) => (
            <option key={s.value} value={s.value} className="text-foreground">
              {s.label}
            </option>
          ))}
        </select>
      </span>
      {closing ? (
        <CloseSaleDialog
          open
          label={label}
          salePrice={salePrice}
          deedDate={deedDate}
          onCancel={() => setClosing(false)}
          onConfirm={async (input) => {
            const r = await changeSaleStage(saleId, "vendido", input);
            if (r.ok) {
              setClosing(false);
              router.refresh();
              return null;
            }
            return r.error;
          }}
        />
      ) : null}
    </>
  );
}
