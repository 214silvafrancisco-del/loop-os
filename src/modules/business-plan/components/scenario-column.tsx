"use client";

import { Check, MoreHorizontal, Star, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/core/lib/format";
import { applyMaxPriceToDeal, deleteScenario, renameScenario, saveScenario, setActiveScenario } from "../actions";
import { calcScenario, maxPurchasePriceForRoe, type CalcContext, type ScenarioInputs } from "../calc";
import { SCENARIO_KIND_LABEL } from "../validation";
import { ComputedRow, NumberField } from "./number-field";
import { ResultsPanel } from "./results-panel";

type Props = {
  scenarioId: string;
  dealId: string;
  name: string;
  kind: "ato_continuo" | "remodelacao" | "custom";
  isActive: boolean;
  initialInputs: ScenarioInputs;
  ctx: CalcContext;
  targetRoe: number;
  canDelete: boolean;
  /** Telemóvel: ocupa toda a largura em vez da coluna de 26 rem. */
  fullWidth?: boolean;
};

function Section({ title, total, children, defaultOpen = true }: { title: string; total?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 text-sm font-semibold">
        <span>{title}</span>
        {total ? <span className="tabular-nums text-muted-foreground group-open:hidden">{total}</span> : null}
      </summary>
      <div className="border-t px-3 py-2">{children}</div>
    </details>
  );
}

function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 w-36 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-7 md:w-32"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function ScenarioColumn({ scenarioId, dealId, name, kind, isActive, initialInputs, ctx, targetRoe, canDelete, fullWidth }: Props) {
  const router = useRouter();
  const [inputs, setInputs] = useState<ScenarioInputs>(initialInputs);
  const [saved, setSaved] = useState<ScenarioInputs>(initialInputs);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null | undefined>(undefined);

  const o = useMemo(() => calcScenario(inputs, ctx), [inputs, ctx]);
  const dirty = JSON.stringify(inputs) !== JSON.stringify(saved);
  const set = <K extends keyof ScenarioInputs>(key: K) => (v: ScenarioInputs[K]) => setInputs((prev) => ({ ...prev, [key]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveScenario(scenarioId, inputs);
      if (!r.ok) return setError(r.error);
      setSaved(inputs);
      router.refresh();
    });
  }
  function activate() {
    startTransition(async () => {
      const r = await setActiveScenario(scenarioId);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }
  function rename() {
    const next = prompt("Nome do cenário", name);
    if (!next || next === name) return;
    startTransition(async () => {
      const r = await renameScenario(scenarioId, next);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }
  function remove() {
    if (!confirm(`Apagar o cenário "${name}"?`)) return;
    startTransition(async () => {
      const r = await deleteScenario(scenarioId);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }
  function computeMax() {
    setMaxPrice(maxPurchasePriceForRoe(inputs, ctx, targetRoe));
  }
  function applyMax() {
    if (!maxPrice) return;
    startTransition(async () => {
      const r = await applyMaxPriceToDeal(dealId, maxPrice);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className={cn("flex shrink-0 flex-col gap-3", fullWidth ? "w-full" : "w-[26rem]", isActive && "rounded-xl ring-2 ring-primary/40 ring-offset-2 ring-offset-background")}>
      <div className="flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={activate}
          disabled={isActive || pending}
          className={cn("flex items-center gap-1 text-xs", isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          title={isActive ? "Cenário ativo" : "Tornar ativo"}
        >
          <Star className={cn("size-4", isActive && "fill-primary")} />
          {isActive ? "Ativo" : "Tornar ativo"}
        </button>
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{name}</h3>
        <span className="text-[11px] text-muted-foreground">{SCENARIO_KIND_LABEL[kind]}</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-11 items-center justify-center rounded-md hover:bg-accent md:size-7" aria-label="Opções do cenário">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={rename}>Mudar nome</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canDelete || isActive} onClick={remove} className="text-destructive">
              Apagar cenário
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="sticky top-14 z-10">
        <ResultsPanel o={o} targetRoe={targetRoe} />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={!dirty || pending} className="h-10 gap-1 md:h-8">
            <Check className="size-4" />
            {pending ? "…" : dirty ? "Guardar" : "Guardado"}
          </Button>
          <Button size="sm" variant="outline" onClick={computeMax} className="h-10 gap-1 md:h-8" title={`Preço de compra para ROE ${formatPercent(targetRoe)}`}>
            <Target className="size-4" />
            Preço máx. p/ ROE {formatPercent(targetRoe)}
          </Button>
        </div>
        {maxPrice !== undefined ? (
          <div className="mt-2 flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
            {maxPrice === null ? (
              <span className="text-muted-foreground">Não é possível atingir o ROE alvo com estes custos.</span>
            ) : (
              <>
                <span>
                  Máximo: <span className="font-semibold tabular-nums">{formatCurrency(maxPrice)}</span>
                </span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setInputs((p) => ({ ...p, purchasePrice: maxPrice }))}>
                    Usar aqui
                  </Button>
                  <Button size="sm" variant="ghost" onClick={applyMax} disabled={pending}>
                    Guardar no negócio
                  </Button>
                </span>
              </>
            )}
          </div>
        ) : null}
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>

      <Section title="Venda" total={formatCurrency(inputs.salePrice)}>
        <NumberField label="Valor de venda" value={inputs.salePrice} onChange={set("salePrice")} />
        <NumberField label="Comissão imobiliária" value={inputs.saleCommissionPct} onChange={set("saleCommissionPct")} kind="pct" />
        <NumberField label="IVA sobre comissão" value={inputs.commissionVatPct} onChange={set("commissionVatPct")} kind="pct" />
        <NumberField label="CPCV de venda" value={inputs.saleCpcvCost} onChange={set("saleCpcvCost")} />
        <NumberField label="Marketing" value={inputs.marketingCost} onChange={set("marketingCost")} />
        <NumberField label="Penal. amortização antecipada" value={inputs.earlyRepaymentPct} onChange={set("earlyRepaymentPct")} kind="pct" />
        <ComputedRow label="Comissão c/ IVA" value={formatCurrency(o.commission)} />
        <ComputedRow label="Total custos de venda" value={formatCurrency(o.saleCosts)} strong />
      </Section>

      <Section title="Aquisição" total={formatCurrency(o.acquisitionTotal)}>
        <NumberField label="Valor de compra" value={inputs.purchasePrice} onChange={set("purchasePrice")} />
        <NumberField label="VPT" value={inputs.vpt} onChange={set("vpt")} hint="Valor patrimonial tributário" />
        <Select
          label="IMT"
          value={inputs.imtRegime}
          onChange={set("imtRegime")}
          options={[
            { value: "isento", label: "Isento (revenda)" },
            { value: "hpp", label: "Habitação própria" },
            { value: "hs", label: "Habitação secundária" },
          ]}
        />
        <ComputedRow label={`IMT (base ${formatCurrency(o.imtBase)})`} value={formatCurrency(o.imt)} />
        <NumberField label="Imposto do Selo" value={inputs.stampDutyPct} onChange={set("stampDutyPct")} kind="pct" />
        <ComputedRow label="IS" value={formatCurrency(o.stampDuty)} />
        <NumberField label="Escritura / DPA" value={inputs.deedCost} onChange={set("deedCost")} />
        <NumberField label="Registos" value={inputs.registrationCost} onChange={set("registrationCost")} />
        <NumberField label="CPCV (minuta)" value={inputs.cpcvCost} onChange={set("cpcvCost")} />
        <NumberField label="Comissão de aquisição" value={inputs.acquisitionCommission} onChange={set("acquisitionCommission")} />
        <NumberField label="Outros" value={inputs.otherAcquisition} onChange={set("otherAcquisition")} />
        <ComputedRow label="Custos de aquisição" value={formatCurrency(o.acquisitionCosts)} />
        <ComputedRow label="Total aquisição" value={formatCurrency(o.acquisitionTotal)} strong />
      </Section>

      <Section title="Financiamento" total={o.financedAmount ? formatCurrency(o.financedAmount) : "sem"} defaultOpen={inputs.ltvPct > 0}>
        <NumberField label="Percentagem financiada" value={inputs.ltvPct} onChange={set("ltvPct")} kind="pct" />
        <ComputedRow label="Valor financiado" value={formatCurrency(o.financedAmount)} />
        <NumberField label="Prazo" value={inputs.termYears} onChange={set("termYears")} kind="int" suffix="anos" />
        <NumberField label="Taxa de juro (TAN)" value={inputs.interestRate} onChange={set("interestRate")} kind="pct" />
        <ComputedRow label="Prestação mensal" value={formatCurrency(o.monthlyPayment)} />
        <NumberField label="Comissão de dossier" value={inputs.feeDossier} onChange={set("feeDossier")} />
        <NumberField label="Comissão de avaliação" value={inputs.feeValuation} onChange={set("feeValuation")} />
        <NumberField label="Comissão de formalização" value={inputs.feeFormalization} onChange={set("feeFormalization")} />
        <NumberField label="IS sobre financiado" value={inputs.stampDutyFinancingPct} onChange={set("stampDutyFinancingPct")} kind="pct" />
        <NumberField label="Registo de hipoteca" value={inputs.mortgageRegistration} onChange={set("mortgageRegistration")} />
        <ComputedRow label="Custos de financiamento" value={formatCurrency(o.financingCosts)} strong />
      </Section>

      <Section title="Obra" total={formatCurrency(o.worksTotal)}>
        <Select
          label="Método"
          value={inputs.worksMethod}
          onChange={set("worksMethod")}
          options={[
            { value: "manual", label: "Orçamento" },
            { value: "per_m2", label: "€/m² × área" },
          ]}
        />
        {inputs.worksMethod === "manual" ? (
          <NumberField label="Orçamento (s/ IVA)" value={inputs.worksBudget} onChange={set("worksBudget")} />
        ) : (
          <>
            <NumberField label="Custo por m²" value={inputs.worksCostPerM2} onChange={set("worksCostPerM2")} />
            <NumberField label="Área bruta (do imóvel)" value={inputs.grossArea} onChange={set("grossArea")} suffix="m²" />
          </>
        )}
        <NumberField label="Contingência" value={inputs.contingencyPct} onChange={set("contingencyPct")} kind="pct" />
        <NumberField label="IVA da obra" value={inputs.worksVatPct} onChange={set("worksVatPct")} kind="pct" hint="6 % em zona ARU, senão 23 %" />
        <ComputedRow label="Obra c/ IVA" value={formatCurrency(o.worksWithVat)} />
        <NumberField label="Arquitetura" value={inputs.architectureCost} onChange={set("architectureCost")} />
        <NumberField label="Licenças" value={inputs.licensesCost} onChange={set("licensesCost")} />
        <NumberField label="Fiscalização" value={inputs.supervisionCost} onChange={set("supervisionCost")} />
        <NumberField label="Outros custos" value={inputs.otherWorks} onChange={set("otherWorks")} />
        <NumberField label="Obra financiada" value={inputs.worksFinancedPct} onChange={set("worksFinancedPct")} kind="pct" />
        {inputs.worksFinancedPct > 0 ? (
          <>
            <NumberField label="Prazo" value={inputs.worksTermYears} onChange={set("worksTermYears")} kind="int" suffix="anos" />
            <NumberField label="Taxa de juro (TAN)" value={inputs.worksInterestRate} onChange={set("worksInterestRate")} kind="pct" />
            <NumberField label="Comissão de dossier" value={inputs.worksFeeDossier} onChange={set("worksFeeDossier")} />
            <NumberField label="Comissão de formalização" value={inputs.worksFeeFormalization} onChange={set("worksFeeFormalization")} />
            <NumberField label="Registo de hipoteca" value={inputs.worksMortgageRegistration} onChange={set("worksMortgageRegistration")} />
            <NumberField label="Tranches (× 150 €)" value={inputs.worksTranches} onChange={set("worksTranches")} kind="int" />
            <ComputedRow label="Prestação da obra" value={formatCurrency(o.worksMonthlyPayment)} />
          </>
        ) : null}
        <ComputedRow label="Total obra" value={formatCurrency(o.worksTotal)} strong />
      </Section>

      <Section title="Detenção" total={formatCurrency(o.holdingCosts)}>
        <NumberField label="Meses de retenção" value={inputs.holdingMonths} onChange={set("holdingMonths")} kind="int" suffix="m" />
        <NumberField label="Seguros / mês" value={inputs.insuranceMonth} onChange={set("insuranceMonth")} />
        <NumberField label="Condomínio / mês" value={inputs.condoMonth} onChange={set("condoMonth")} />
        <NumberField label="Eletricidade / mês" value={inputs.electricityMonth} onChange={set("electricityMonth")} />
        <NumberField label="Água / mês" value={inputs.waterMonth} onChange={set("waterMonth")} />
        <NumberField label="IMI" value={inputs.imi} onChange={set("imi")} />
        <NumberField label="Outros" value={inputs.otherHolding} onChange={set("otherHolding")} />
        {o.interestProperty || o.interestWorks ? (
          <ComputedRow label="Juros no período" value={formatCurrency(o.interestProperty + o.interestWorks)} />
        ) : null}
        <ComputedRow label="Total detenção" value={formatCurrency(o.holdingCosts)} strong />
      </Section>

      <Section title="Impostos" total={formatCurrency(o.tax)} defaultOpen={false}>
        <Select
          label="Regime"
          value={inputs.taxRegime}
          onChange={set("taxRegime")}
          options={[
            { value: "empresa", label: "Empresa (IRC)" },
            { value: "particular", label: "Particular (IRS)" },
          ]}
        />
        {inputs.taxRegime === "empresa" ? (
          <NumberField label="IRC" value={inputs.ircPct} onChange={set("ircPct")} kind="pct" />
        ) : (
          <NumberField label="IRS (sobre 50 %)" value={inputs.irsPct} onChange={set("irsPct")} kind="pct" />
        )}
        <ComputedRow label="Imposto estimado" value={formatCurrency(o.tax)} strong />
      </Section>

      <Section title="Resumo" defaultOpen={false}>
        <ComputedRow label="Receita" value={formatCurrency(o.revenue)} />
        <ComputedRow label="Preço de compra" value={formatCurrency(inputs.purchasePrice)} />
        <ComputedRow label="Todos os custos" value={formatCurrency(o.totalCosts)} />
        <ComputedRow label="Investimento total" value={formatCurrency(o.totalInvestment)} />
        <ComputedRow label="Financiamento" value={formatCurrency(o.financing)} />
        <ComputedRow label="Capital próprio" value={formatCurrency(o.equity)} />
        <ComputedRow label="Lucro bruto" value={formatCurrency(o.grossProfit)} strong />
        <ComputedRow label="Lucro líquido" value={formatCurrency(o.netProfit)} strong />
        <ComputedRow label="ROI líquido" value={formatPercent(o.netRoi)} />
        <ComputedRow label="ROE líquido" value={formatPercent(o.netRoe)} />
        <ComputedRow label="Anualizado líquido" value={formatPercent(o.netAnnualized)} />
        {o.profitPerM2 !== null ? <ComputedRow label="Lucro por m²" value={formatCurrency(o.profitPerM2)} /> : null}
      </Section>
    </div>
  );
}
