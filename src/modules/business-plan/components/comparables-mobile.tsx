"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/core/lib/format";
import type { ComparableDraft } from "../comparables-actions";
import type { calcValuation } from "../calc";

type Result = ReturnType<typeof calcValuation>;
type AdjKey = "adjNegotiation" | "adjArea" | "adjLocation" | "adjAge" | "adjCondition" | "adjOther";

type Props = {
  rows: ComparableDraft[];
  result: Result;
  adjRows: { key: AdjKey; label: string; hint: string }[];
  conditions: readonly { value: string; label: string }[];
  onUpdate: (index: number, patch: Partial<ComparableDraft>) => void;
  onSetArea: (index: number, area: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

const field = "h-11 w-full rounded-lg border bg-background px-3 text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Comparáveis no telemóvel: um cartão por anúncio, com os mesmos campos da tabela. */
export function ComparablesMobile({ rows, result, adjRows, conditions, onUpdate, onSetArea, onAdd, onRemove }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => {
        const c = result.perComparable[i];
        return (
          <section key={i} className={cn("rounded-xl border bg-card", !r.isIncluded && "opacity-70")}>
            <header className="flex items-center gap-2 border-b px-3 py-2">
              <input type="checkbox" checked={r.isIncluded} onChange={(e) => onUpdate(i, { isIncluded: e.target.checked })} title="Entra na média" className="size-5 accent-primary" />
              <input value={r.label ?? ""} onChange={(e) => onUpdate(i, { label: e.target.value || null })} placeholder={`#${i + 1}`} className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <span className="shrink-0 text-sm font-semibold tabular-nums">{c ? formatCurrency(c.adjustedPricePerM2) : "—"}<span className="text-xs font-normal text-muted-foreground">/m²</span></span>
              <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground hover:text-destructive" aria-label="Remover" onClick={() => onRemove(i)}>
                <Trash2 className="size-4" />
              </Button>
            </header>
            <div className="grid grid-cols-2 gap-2 px-3 py-3">
              <label className="text-xs text-muted-foreground">Preço (€)<input type="number" value={r.price || ""} onChange={(e) => onUpdate(i, { price: Number(e.target.value || 0) })} onFocus={(e) => e.target.select()} className={field} /></label>
              <label className="text-xs text-muted-foreground">Área (m²)<input type="number" step={0.1} value={r.area || ""} onChange={(e) => onSetArea(i, Number(e.target.value || 0))} onFocus={(e) => e.target.select()} className={field} /></label>
              <p className="col-span-2 text-sm">€/m²: <span className="font-medium tabular-nums">{c ? formatCurrency(c.pricePerM2) : "—"}</span></p>
              <label className="text-xs text-muted-foreground">Piso<input value={r.floor ?? ""} onChange={(e) => onUpdate(i, { floor: e.target.value || null })} className={cn(field, "text-left")} /></label>
              <label className="text-xs text-muted-foreground">Elevador<select value={r.hasElevator === null ? "" : r.hasElevator ? "1" : "0"} onChange={(e) => onUpdate(i, { hasElevator: e.target.value === "" ? null : e.target.value === "1" })} className={cn(field, "text-left")}><option value="">—</option><option value="1">Sim</option><option value="0">Não</option></select></label>
              <label className="col-span-2 text-xs text-muted-foreground">Estado<select value={r.condition ?? ""} onChange={(e) => onUpdate(i, { condition: (e.target.value || null) as ComparableDraft["condition"] })} className={cn(field, "text-left")}>{conditions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
              <label className="col-span-2 text-xs text-muted-foreground">Link<input value={r.sourceUrl ?? ""} onChange={(e) => onUpdate(i, { sourceUrl: e.target.value || null })} placeholder="idealista.pt/…" inputMode="url" className={cn(field, "text-left")} /></label>
            </div>
            <div className="border-t px-3 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Homogeneização (%)</p>
              <div className="grid grid-cols-2 gap-2">
                {adjRows.map((a) => (
                  <label key={a.key} className="text-xs text-muted-foreground" title={a.hint}>
                    {a.label}
                    <input type="number" step={0.5} value={Math.round(r[a.key] * 10000) / 100} onChange={(e) => onUpdate(i, { [a.key]: Number(e.target.value || 0) / 100 })} onFocus={(e) => e.target.select()} className={field} />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className={cn("font-medium tabular-nums", c && c.totalAdjustment < 0 ? "text-destructive" : c && c.totalAdjustment > 0 ? "text-success" : "")}>{c ? (c.totalAdjustment * 100).toFixed(1) : "0.0"} %</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>€/m² ajustado</span>
                <span className={cn("tabular-nums", !r.isIncluded && "line-through opacity-50")}>{c ? formatCurrency(c.adjustedPricePerM2) : "—"}</span>
              </div>
              <label className="mt-2 block text-xs text-muted-foreground">Notas<input value={r.notes ?? ""} onChange={(e) => onUpdate(i, { notes: e.target.value || null })} className={cn(field, "text-left")} /></label>
            </div>
          </section>
        );
      })}
      {rows.length === 0 ? <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Sem comparáveis. Adiciona 3 ou 4 anúncios semelhantes.</p> : null}
      <Button type="button" variant="outline" onClick={onAdd} className="h-11 gap-1">
        <Plus className="size-4" /> Adicionar comparável
      </Button>
    </div>
  );
}
