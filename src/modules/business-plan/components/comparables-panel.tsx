"use client";

import { ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatArea, formatCurrency } from "@/core/lib/format";
import { calcValuation, defaultAreaAdjustment } from "../calc";
import { applyValuationToScenario, saveComparables, type ComparableDraft } from "../comparables-actions";
import { ComparablesMobile } from "./comparables-mobile";

type ScenarioOption = { id: string; name: string; isActive: boolean; salePrice: number };
type References = { referenceM2Idealista: number | null; referenceM2Maxwork: number | null; referenceM2Consultant: number | null };

type Props = {
  businessPlanId: string;
  propertyId: string;
  base: { area: number; year: number | null; floor: string | null; hasElevator: boolean | null };
  areaAdjPctPerM2: number;
  initialRows: ComparableDraft[];
  initialRefs: References;
  scenarios: ScenarioOption[];
};

const CONDITIONS = [
  { value: "", label: "—" },
  { value: "para_obras", label: "Para obras" },
  { value: "habitavel", label: "Habitável" },
  { value: "remodelado", label: "Remodelado" },
  { value: "novo", label: "Novo" },
] as const;

const ADJ_ROWS: { key: keyof Pick<ComparableDraft, "adjNegotiation" | "adjArea" | "adjLocation" | "adjAge" | "adjCondition" | "adjOther">; label: string; hint: string }[] = [
  { key: "adjNegotiation", label: "Negociação", hint: "Margem de negociação face ao anúncio (ex.: −5 %)." },
  { key: "adjArea", label: "Área", hint: "Calculado: −(m² comparável − m² imóvel) × % por m². Editável." },
  { key: "adjLocation", label: "Localização", hint: "Comparável melhor que o imóvel ⇒ negativo." },
  { key: "adjAge", label: "Idade", hint: "" },
  { key: "adjCondition", label: "Conservação", hint: "Remodelado vs. para obras ⇒ negativo." },
  { key: "adjOther", label: "Outros", hint: "" },
];

function cell(extra = "") {
  return cn("h-8 w-full rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring", extra);
}

export function ComparablesPanel({ businessPlanId, propertyId, base, areaAdjPctPerM2, initialRows, initialRefs, scenarios }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ComparableDraft[]>(initialRows);
  const [refs, setRefs] = useState<References>(initialRefs);
  const [saved, setSaved] = useState(JSON.stringify({ rows: initialRows, refs: initialRefs }));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [targetScenario, setTargetScenario] = useState(scenarios.find((s) => s.isActive)?.id ?? scenarios[0]?.id ?? "");

  const result = useMemo(() => calcValuation(rows, base.area), [rows, base.area]);
  const dirty = JSON.stringify({ rows, refs }) !== saved;

  function update(index: number, patch: Partial<ComparableDraft>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function setArea(index: number, area: number) {
    update(index, { area, adjArea: defaultAreaAdjustment(area, base.area, areaAdjPctPerM2) });
  }
  function add() {
    setRows((prev) => [
      ...prev,
      {
        id: null, label: `#${prev.length + 1}`, sourceUrl: null, price: 0, area: 0, floor: null, hasElevator: null, condition: null,
        adjNegotiation: -0.05, adjArea: 0, adjLocation: 0, adjAge: 0, adjCondition: 0, adjOther: 0, notes: null, isIncluded: true,
      },
    ]);
  }
  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }
  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveComparables(businessPlanId, rows, { ...refs, valuationM2: result.averagePricePerM2 || null });
      if (!r.ok) return setError(r.error);
      setSaved(JSON.stringify({ rows, refs }));
      router.refresh();
    });
  }
  function apply() {
    if (!targetScenario || !result.valuation) return;
    setError(null);
    startTransition(async () => {
      const r = await applyValuationToScenario(targetScenario, result.valuation);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  const pctInput = (index: number, key: (typeof ADJ_ROWS)[number]["key"]) => (
    <input
      type="number"
      step={0.5}
      value={Math.round(rows[index]![key] * 10000) / 100}
      onChange={(e) => update(index, { [key]: Number(e.target.value || 0) / 100 })}
      onFocus={(e) => e.target.select()}
      className={cell("w-20")}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
        <span className="font-semibold">Imóvel</span>
        <span>Área bruta: <b className="tabular-nums">{formatArea(base.area)}</b></span>
        <span>Ano: {base.year ?? "?"}</span>
        <span>Piso: {base.floor ?? "?"}</span>
        <span>Elevador: {base.hasElevator === null ? "?" : base.hasElevator ? "sim" : "não"}</span>
        <Link href={`/properties/${propertyId}`} className="ml-auto text-xs text-muted-foreground hover:text-foreground hover:underline">
          Editar imóvel
        </Link>
        {base.area <= 0 ? <span className="w-full text-xs text-destructive">Sem área bruta no imóvel: a avaliação não pode ser calculada.</span> : null}
      </div>

      {/* Telemóvel: um cartão por comparável */}
      <div className="md:hidden">
        <ComparablesMobile rows={rows} result={result} adjRows={ADJ_ROWS} conditions={CONDITIONS} onUpdate={update} onSetArea={setArea} onAdd={add} onRemove={remove} />
      </div>

      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-40 px-3 py-2 text-left font-medium text-muted-foreground">Comparável</th>
              {rows.map((r, i) => (
                <th key={i} className="min-w-44 px-2 py-2 text-left">
                  <div className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={r.isIncluded}
                      onChange={(e) => update(i, { isIncluded: e.target.checked })}
                      title="Entra na média"
                      className="accent-primary"
                    />
                    <input
                      value={r.label ?? ""}
                      onChange={(e) => update(i, { label: e.target.value || null })}
                      placeholder={`#${i + 1}`}
                      className="h-7 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <button type="button" onClick={() => remove(i)} className="rounded p-1 text-muted-foreground hover:text-destructive" title="Remover">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-2 py-2">
                <Button type="button" size="sm" variant="outline" onClick={add} className="gap-1">
                  <Plus className="size-4" />
                  Adicionar
                </Button>
              </th>
            </tr>
          </thead>
          <tbody className="[&_td]:px-2 [&_td]:py-1 [&_th]:px-3 [&_th]:py-1 [&_th]:text-left [&_th]:font-normal [&_th]:text-muted-foreground">
            <tr><th>Preço de venda (€)</th>{rows.map((r, i) => <td key={i}><input type="number" value={r.price || ""} onChange={(e) => update(i, { price: Number(e.target.value || 0) })} onFocus={(e) => e.target.select()} className={cell()} /></td>)}<td /></tr>
            <tr><th>Área (m²)</th>{rows.map((r, i) => <td key={i}><input type="number" step={0.1} value={r.area || ""} onChange={(e) => setArea(i, Number(e.target.value || 0))} onFocus={(e) => e.target.select()} className={cell()} /></td>)}<td /></tr>
            <tr className="bg-muted/40"><th>€/m²</th>{result.perComparable.map((c, i) => <td key={i} className="text-right tabular-nums">{formatCurrency(c.pricePerM2)}</td>)}<td /></tr>
            <tr><th>Piso</th>{rows.map((r, i) => <td key={i}><input value={r.floor ?? ""} onChange={(e) => update(i, { floor: e.target.value || null })} className={cell("text-left")} /></td>)}<td /></tr>
            <tr><th>Elevador</th>{rows.map((r, i) => <td key={i}><select value={r.hasElevator === null ? "" : r.hasElevator ? "1" : "0"} onChange={(e) => update(i, { hasElevator: e.target.value === "" ? null : e.target.value === "1" })} className={cell("text-left")}><option value="">—</option><option value="1">Sim</option><option value="0">Não</option></select></td>)}<td /></tr>
            <tr><th>Estado</th>{rows.map((r, i) => <td key={i}><select value={r.condition ?? ""} onChange={(e) => update(i, { condition: (e.target.value || null) as ComparableDraft["condition"] })} className={cell("text-left")}>{CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></td>)}<td /></tr>
            <tr><th>Link</th>{rows.map((r, i) => <td key={i}><input value={r.sourceUrl ?? ""} onChange={(e) => update(i, { sourceUrl: e.target.value || null })} placeholder="idealista.pt/…" className={cell("text-left")} /></td>)}<td /></tr>
            <tr className="border-t bg-muted/40"><th colSpan={rows.length + 2} className="py-2 font-semibold text-foreground">Homogeneização (%)</th></tr>
            {ADJ_ROWS.map((a) => (
              <tr key={a.key}><th title={a.hint}>{a.label}</th>{rows.map((_, i) => <td key={i}>{pctInput(i, a.key)}</td>)}<td /></tr>
            ))}
            <tr className="bg-muted/40 font-medium"><th>Total</th>{result.perComparable.map((c, i) => <td key={i} className={cn("text-right tabular-nums", c.totalAdjustment < 0 ? "text-destructive" : c.totalAdjustment > 0 ? "text-success" : "")}>{(c.totalAdjustment * 100).toFixed(1)} %</td>)}<td /></tr>
            <tr className="bg-primary/5 font-semibold"><th className="text-foreground">€/m² ajustado</th>{result.perComparable.map((c, i) => <td key={i} className={cn("text-right tabular-nums", !rows[i]!.isIncluded && "line-through opacity-50")}>{formatCurrency(c.adjustedPricePerM2)}</td>)}<td /></tr>
            <tr><th>Notas</th>{rows.map((r, i) => <td key={i}><input value={r.notes ?? ""} onChange={(e) => update(i, { notes: e.target.value || null })} className={cell("text-left")} /></td>)}<td /></tr>
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sem comparáveis. Adiciona 3 ou 4 anúncios semelhantes.</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Validação</h3>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">€/m² médio ({result.includedCount} comparáveis)</span><span className="font-semibold tabular-nums">{formatCurrency(result.averagePricePerM2)}</span></div>
            {(
              [
                ["referenceM2Idealista", "€/m² Idealista"],
                ["referenceM2Maxwork", "€/m² Maxwork"],
                ["referenceM2Consultant", "€/m² consultor"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{label}</span>
                <input type="number" value={refs[key] ?? ""} onChange={(e) => setRefs((p) => ({ ...p, [key]: e.target.value === "" ? null : Number(e.target.value) }))} className={cell("w-28")} />
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border bg-primary/5 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor de venda sugerido</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(result.valuation)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(result.averagePricePerM2)} × {formatArea(base.area)}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={targetScenario} onChange={(e) => setTargetScenario(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.isActive ? " (ativo)" : ""} · {formatCurrency(s.salePrice)}</option>
              ))}
            </select>
            <Button size="sm" onClick={apply} disabled={pending || !result.valuation || !targetScenario} className="gap-1">
              <ArrowRight className="size-4" />
              Usar no cenário
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
        <Button onClick={save} disabled={!dirty || pending} className="h-11 gap-1 md:h-8">
          <Check className="size-4" />
          {pending ? "…" : dirty ? "Guardar comparáveis" : "Guardado"}
        </Button>
      </div>
    </div>
  );
}
