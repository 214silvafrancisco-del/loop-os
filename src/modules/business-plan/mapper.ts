import { DEFAULT_INPUTS, type ScenarioInputs, type ScenarioOutputs } from "./calc";
import type { BpScenario, NewBpScenario } from "./schema";

const n = (v: string | number | null | undefined, fallback = 0): number => {
  if (v === null || v === undefined || v === "") return fallback;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : fallback;
};

/** Contexto do imóvel que o cenário não guarda (vem de `properties`). */
export type PropertyContext = { grossArea: number; isAru: boolean };

/** Linha da BD (strings numeric) → inputs numéricos do motor. */
export function scenarioRowToInputs(row: BpScenario, property: PropertyContext): ScenarioInputs {
  return {
    salePrice: n(row.salePrice),
    saleCommissionPct: n(row.saleCommissionPct),
    commissionVatPct: n(row.commissionVatPct),
    saleCpcvCost: n(row.saleCpcvCost),
    marketingCost: n(row.marketingCost),
    earlyRepaymentPct: n(row.earlyRepaymentPct),

    purchasePrice: n(row.purchasePrice),
    vpt: n(row.vpt),
    imtRegime: row.imtRegime,
    imtOverride: row.imtOverride === null ? null : n(row.imtOverride),
    stampDutyPct: n(row.stampDutyPct),
    deedCost: n(row.deedCost),
    registrationCost: n(row.registrationCost),
    cpcvCost: n(row.cpcvCost),
    acquisitionCommission: n(row.acquisitionCommission),
    otherAcquisition: n(row.otherAcquisition),

    ltvPct: n(row.ltvPct),
    termYears: n(row.termYears, 40),
    interestRate: n(row.interestRate),
    feeDossier: n(row.feeDossier),
    feeValuation: n(row.feeValuation),
    feeFormalization: n(row.feeFormalization),
    stampDutyFinancingPct: n(row.stampDutyFinancingPct),
    mortgageRegistration: n(row.mortgageRegistration),

    worksMethod: row.worksMethod,
    worksBudget: n(row.worksBudget),
    worksCostPerM2: n(row.worksCostPerM2),
    grossArea: property.grossArea,
    worksVatPct: n(row.worksVatPct),
    contingencyPct: n(row.contingencyPct),
    architectureCost: n(row.architectureCost),
    licensesCost: n(row.licensesCost),
    supervisionCost: n(row.supervisionCost),
    otherWorks: n(row.otherWorks),
    worksFinancedPct: n(row.worksFinancedPct),
    worksTermYears: n(row.worksTermYears, 40),
    worksInterestRate: n(row.worksInterestRate),
    worksFeeDossier: n(row.worksFeeDossier),
    worksFeeFormalization: n(row.worksFeeFormalization),
    worksMortgageRegistration: n(row.worksMortgageRegistration),
    worksTranches: n(row.worksTranches),
    worksTrancheCost: DEFAULT_INPUTS.worksTrancheCost,

    holdingMonths: n(row.holdingMonths),
    insuranceMonth: n(row.insuranceMonth),
    condoMonth: n(row.condoMonth),
    electricityMonth: n(row.electricityMonth),
    waterMonth: n(row.waterMonth),
    imi: n(row.imi),
    otherHolding: n(row.otherHolding),

    taxRegime: row.taxRegime,
    ircPct: n(row.ircPct),
    irsPct: n(row.irsPct),
  };
}

const money = (v: number) => v.toFixed(2);
const pct = (v: number) => v.toFixed(4);

/** Inputs numéricos → colunas da BD (strings numeric). */
export function inputsToScenarioColumns(i: ScenarioInputs): Partial<NewBpScenario> {
  return {
    salePrice: money(i.salePrice),
    saleCommissionPct: pct(i.saleCommissionPct),
    commissionVatPct: pct(i.commissionVatPct),
    saleCpcvCost: money(i.saleCpcvCost),
    marketingCost: money(i.marketingCost),
    earlyRepaymentPct: pct(i.earlyRepaymentPct),
    purchasePrice: money(i.purchasePrice),
    vpt: money(i.vpt),
    imtRegime: i.imtRegime,
    imtOverride: i.imtOverride === null ? null : money(i.imtOverride),
    stampDutyPct: pct(i.stampDutyPct),
    deedCost: money(i.deedCost),
    registrationCost: money(i.registrationCost),
    cpcvCost: money(i.cpcvCost),
    acquisitionCommission: money(i.acquisitionCommission),
    otherAcquisition: money(i.otherAcquisition),
    ltvPct: pct(i.ltvPct),
    termYears: Math.round(i.termYears),
    interestRate: pct(i.interestRate),
    feeDossier: money(i.feeDossier),
    feeValuation: money(i.feeValuation),
    feeFormalization: money(i.feeFormalization),
    stampDutyFinancingPct: pct(i.stampDutyFinancingPct),
    mortgageRegistration: money(i.mortgageRegistration),
    worksMethod: i.worksMethod,
    worksBudget: money(i.worksBudget),
    worksCostPerM2: money(i.worksCostPerM2),
    worksVatPct: pct(i.worksVatPct),
    contingencyPct: pct(i.contingencyPct),
    architectureCost: money(i.architectureCost),
    licensesCost: money(i.licensesCost),
    supervisionCost: money(i.supervisionCost),
    otherWorks: money(i.otherWorks),
    worksFinancedPct: pct(i.worksFinancedPct),
    worksTermYears: Math.round(i.worksTermYears),
    worksInterestRate: pct(i.worksInterestRate),
    worksFeeDossier: money(i.worksFeeDossier),
    worksFeeFormalization: money(i.worksFeeFormalization),
    worksMortgageRegistration: money(i.worksMortgageRegistration),
    worksTranches: Math.round(i.worksTranches),
    holdingMonths: Math.round(i.holdingMonths),
    insuranceMonth: money(i.insuranceMonth),
    condoMonth: money(i.condoMonth),
    electricityMonth: money(i.electricityMonth),
    waterMonth: money(i.waterMonth),
    imi: money(i.imi),
    otherHolding: money(i.otherHolding),
    taxRegime: i.taxRegime,
    ircPct: pct(i.ircPct),
    irsPct: pct(i.irsPct),
  };
}

/** Resultados → colunas out_* (snapshot). */
export function outputsToColumns(o: ScenarioOutputs, calcVersion: string): Partial<NewBpScenario> {
  const r6 = (v: number) => v.toFixed(6);
  return {
    outTotalInvestment: money(o.totalInvestment),
    outEquity: money(o.equity),
    outFinancing: money(o.financing),
    outTotalCosts: money(o.totalCosts),
    outRevenue: money(o.revenue),
    outGrossProfit: money(o.grossProfit),
    outTax: money(o.tax),
    outNetProfit: money(o.netProfit),
    outMargin: r6(o.margin),
    outRoi: r6(o.roi),
    outRoe: r6(o.roe),
    outAnnualized: r6(o.annualized),
    outIrr: null,
    outProfitPerM2: o.profitPerM2 === null ? null : money(o.profitPerM2),
    outBreakEvenPrice: money(o.breakEvenPrice),
    outCalcVersion: calcVersion,
    calculatedAt: new Date(),
  };
}

/** Cenários por defeito de um negócio novo (decisão 2026-09-29). */
export function defaultScenarioInputs(
  kind: "ato_continuo" | "remodelacao",
  seed: { purchasePrice: number; salePrice: number; vpt: number; worksBudget: number; isAru: boolean; grossArea: number },
): ScenarioInputs {
  const base: ScenarioInputs = {
    ...DEFAULT_INPUTS,
    purchasePrice: seed.purchasePrice,
    salePrice: seed.salePrice,
    vpt: seed.vpt,
    grossArea: seed.grossArea,
    worksVatPct: seed.isAru ? 0.06 : 0.23,
  };
  if (kind === "ato_continuo") {
    return { ...base, worksMethod: "manual", worksBudget: 0, holdingMonths: 2 };
  }
  return { ...base, worksMethod: "manual", worksBudget: seed.worksBudget, holdingMonths: 6 };
}
