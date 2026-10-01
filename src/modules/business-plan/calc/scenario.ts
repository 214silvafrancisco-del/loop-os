import { calcImt, cumipmt, pmt, round2, type ImtBracket } from "./finance";

/** Versão do motor. Guardada com cada snapshot; se mudar, a app recalcula. */
export const CALC_VERSION = "2026.09.1";

export type ImtRegime = "isento" | "hpp" | "hs";
export type TaxRegime = "empresa" | "particular";
export type WorksMethod = "manual" | "per_m2";

/** Inputs de um cenário. Percentagens como fração (0.05 = 5 %). Tudo em euros. */
export type ScenarioInputs = {
  // Venda
  salePrice: number;
  saleCommissionPct: number;
  commissionVatPct: number;
  saleCpcvCost: number;
  marketingCost: number;
  earlyRepaymentPct: number;

  // Aquisição
  purchasePrice: number;
  vpt: number;
  imtRegime: ImtRegime;
  imtOverride: number | null;
  stampDutyPct: number;
  deedCost: number;
  registrationCost: number;
  cpcvCost: number;
  acquisitionCommission: number;
  otherAcquisition: number;

  // Financiamento do imóvel
  ltvPct: number;
  termYears: number;
  interestRate: number;
  feeDossier: number;
  feeValuation: number;
  feeFormalization: number;
  stampDutyFinancingPct: number;
  mortgageRegistration: number;

  // Obra
  worksMethod: WorksMethod;
  worksBudget: number;
  worksCostPerM2: number;
  grossArea: number;
  worksVatPct: number;
  contingencyPct: number;
  architectureCost: number;
  licensesCost: number;
  supervisionCost: number;
  otherWorks: number;
  worksFinancedPct: number;
  worksTermYears: number;
  worksInterestRate: number;
  worksFeeDossier: number;
  worksFeeFormalization: number;
  worksMortgageRegistration: number;
  worksTranches: number;
  worksTrancheCost: number;

  // Detenção
  holdingMonths: number;
  insuranceMonth: number;
  condoMonth: number;
  electricityMonth: number;
  waterMonth: number;
  imi: number;
  otherHolding: number;

  // Impostos
  taxRegime: TaxRegime;
  ircPct: number;
  irsPct: number;
};

export type ScenarioOutputs = {
  // Aquisição
  imtBase: number;
  imt: number;
  stampDuty: number;
  acquisitionCosts: number; // sem o preço
  acquisitionTotal: number; // com o preço
  // Financiamento imóvel
  financedAmount: number;
  monthlyPayment: number;
  financingCosts: number;
  // Obra
  worksNet: number;
  worksWithVat: number;
  worksFinanced: number;
  worksMonthlyPayment: number;
  worksTotal: number; // c/ IVA + contingência + projetos + custos de financiamento da obra
  // Detenção
  interestProperty: number;
  interestWorks: number;
  holdingCosts: number;
  // Venda
  commission: number;
  earlyRepaymentPenalty: number;
  saleCosts: number;
  // Resultados
  totalCosts: number; // todos os custos sem o preço de compra
  totalInvestment: number; // preço + todos os custos
  equity: number; // capital próprio necessário
  financing: number; // total financiado
  revenue: number;
  grossProfit: number;
  tax: number;
  netProfit: number;
  margin: number; // lucro líquido / receita
  roi: number; // lucro bruto / investimento total (Excel "Retorno Total Investimento")
  roe: number; // lucro bruto / capital próprio (Excel "Cash-on-Cash")
  annualized: number; // roi × 12 / meses
  netRoi: number;
  netRoe: number;
  netAnnualized: number;
  profitPerM2: number | null;
  breakEvenPrice: number; // preço de venda para lucro bruto zero
  months: number;
};

export type CalcContext = {
  imtBrackets: Record<Exclude<ImtRegime, "isento">, ImtBracket[]>;
};

export function calcScenario(i: ScenarioInputs, ctx: CalcContext): ScenarioOutputs {
  // ── Aquisição ────────────────────────────────────────────────────────
  const imtBase = Math.max(i.purchasePrice, i.vpt);
  let imt = 0;
  if (i.imtOverride !== null && i.imtOverride !== undefined) imt = i.imtOverride;
  else if (i.imtRegime === "hpp") imt = calcImt(imtBase, ctx.imtBrackets.hpp);
  else if (i.imtRegime === "hs") imt = calcImt(imtBase, ctx.imtBrackets.hs);
  const stampDuty = round2(imtBase * i.stampDutyPct);
  const acquisitionCosts = round2(
    imt + stampDuty + i.deedCost + i.registrationCost + i.cpcvCost + i.acquisitionCommission + i.otherAcquisition,
  );
  const acquisitionTotal = round2(i.purchasePrice + acquisitionCosts);

  // ── Financiamento do imóvel ──────────────────────────────────────────
  const financedAmount = round2(i.ltvPct * i.purchasePrice);
  const monthlyRate = i.interestRate / 12;
  const termMonths = Math.round(i.termYears * 12);
  const monthlyPayment = round2(pmt(monthlyRate, termMonths, financedAmount));
  const financingCosts =
    financedAmount > 0
      ? round2(
          i.feeDossier +
            i.feeValuation +
            i.feeFormalization +
            financedAmount * i.stampDutyFinancingPct +
            i.mortgageRegistration,
        )
      : 0;

  // ── Obra ─────────────────────────────────────────────────────────────
  const worksBase = i.worksMethod === "per_m2" ? i.grossArea * i.worksCostPerM2 : i.worksBudget;
  const worksNet = round2(worksBase * (1 + i.contingencyPct));
  const worksWithVat = round2(worksNet * (1 + i.worksVatPct));
  const worksFinanced = round2(i.worksFinancedPct * worksWithVat);
  const worksMonthlyRate = i.worksInterestRate / 12;
  const worksTermMonths = Math.round(i.worksTermYears * 12);
  const worksMonthlyPayment = round2(pmt(worksMonthlyRate, worksTermMonths, worksFinanced));
  const worksFinancingCosts =
    worksFinanced > 0
      ? round2(
          i.worksFeeDossier +
            i.worksFeeFormalization +
            worksFinanced * i.stampDutyFinancingPct +
            i.worksMortgageRegistration +
            i.worksTranches * i.worksTrancheCost,
        )
      : 0;
  const worksTotal = round2(
    worksWithVat + i.architectureCost + i.licensesCost + i.supervisionCost + i.otherWorks + worksFinancingCosts,
  );

  // ── Detenção ─────────────────────────────────────────────────────────
  const months = Math.max(0, i.holdingMonths);
  const interestProperty = round2(cumipmt(monthlyRate, termMonths, financedAmount, 1, months));
  const interestWorks = round2(cumipmt(worksMonthlyRate, worksTermMonths, worksFinanced, 1, months));
  const holdingCosts = round2(
    months * (i.insuranceMonth + i.condoMonth + i.electricityMonth + i.waterMonth) +
      i.imi +
      i.otherHolding +
      interestProperty +
      interestWorks,
  );

  // ── Venda ────────────────────────────────────────────────────────────
  const commissionFactor = i.saleCommissionPct * (1 + i.commissionVatPct);
  const commission = round2(i.salePrice * commissionFactor);
  const outstandingProperty = Math.max(0, financedAmount - months * monthlyPayment);
  const outstandingWorks = Math.max(0, worksFinanced - months * worksMonthlyPayment);
  const earlyRepaymentPenalty = round2(i.earlyRepaymentPct * (outstandingProperty + outstandingWorks));
  const saleCosts = round2(commission + i.saleCpcvCost + i.marketingCost + earlyRepaymentPenalty);

  // ── Resultados ───────────────────────────────────────────────────────
  const totalCosts = round2(acquisitionCosts + financingCosts + worksTotal + holdingCosts + saleCosts);
  const totalInvestment = round2(i.purchasePrice + totalCosts);
  const financing = round2(financedAmount + worksFinanced);
  const equity = round2(totalInvestment - saleCosts - financing);
  const revenue = i.salePrice;
  const grossProfit = round2(revenue - totalInvestment);
  const taxable = Math.max(0, grossProfit);
  const tax = round2(i.taxRegime === "empresa" ? taxable * i.ircPct : taxable * 0.5 * i.irsPct);
  const netProfit = round2(grossProfit - tax);

  const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);
  const roi = safeDiv(grossProfit, totalInvestment);
  const roe = safeDiv(grossProfit, equity);
  const annualized = months > 0 ? roi * (12 / months) : 0;
  const netRoi = safeDiv(netProfit, totalInvestment);
  const netRoe = safeDiv(netProfit, equity);
  const netAnnualized = months > 0 ? netRoi * (12 / months) : 0;
  const margin = safeDiv(netProfit, revenue);
  const profitPerM2 = i.grossArea > 0 ? round2(grossProfit / i.grossArea) : null;

  // Lucro bruto 0: S − (investimento sem comissão) − S × fator = 0
  const costsWithoutCommission = totalInvestment - commission;
  const breakEvenPrice = commissionFactor < 1 ? round2(costsWithoutCommission / (1 - commissionFactor)) : 0;

  return {
    imtBase,
    imt,
    stampDuty,
    acquisitionCosts,
    acquisitionTotal,
    financedAmount,
    monthlyPayment,
    financingCosts,
    worksNet,
    worksWithVat,
    worksFinanced,
    worksMonthlyPayment,
    worksTotal,
    interestProperty,
    interestWorks,
    holdingCosts,
    commission,
    earlyRepaymentPenalty,
    saleCosts,
    totalCosts,
    totalInvestment,
    equity,
    financing,
    revenue,
    grossProfit,
    tax,
    netProfit,
    margin,
    roi,
    roe,
    annualized,
    netRoi,
    netRoe,
    netAnnualized,
    profitPerM2,
    breakEvenPrice,
    months,
  };
}

/** Métricas que podem servir de alvo ao preço máximo. */
export type TargetMetric = "annualized" | "roe";

/**
 * Preço máximo de compra para atingir um alvo numa métrica (bissecção sobre
 * o preço; o resto dos inputs fica igual). O critério da LOOP é o **retorno
 * anualizado** (lucro bruto / investimento total × 12 / meses) ≥ 30 %.
 */
export function maxPurchasePriceFor(
  metric: TargetMetric,
  inputs: ScenarioInputs,
  ctx: CalcContext,
  target: number,
  options: { min?: number; max?: number } = {},
): number | null {
  let lo = options.min ?? 0;
  let hi = options.max ?? Math.max(inputs.salePrice, inputs.purchasePrice, 1);
  const at = (price: number) => calcScenario({ ...inputs, purchasePrice: price }, ctx)[metric];
  if (at(lo) < target) return null; // nem a custo zero se atinge
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (at(mid) >= target) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

/** Preço máximo para um retorno anualizado alvo (critério de validação do negócio). */
export function maxPurchasePriceForAnnualized(inputs: ScenarioInputs, ctx: CalcContext, target: number, options?: { min?: number; max?: number }) {
  return maxPurchasePriceFor("annualized", inputs, ctx, target, options);
}

/** Preço máximo para um ROE alvo (mantido para comparação). */
export function maxPurchasePriceForRoe(inputs: ScenarioInputs, ctx: CalcContext, targetRoe: number, options?: { min?: number; max?: number }) {
  return maxPurchasePriceFor("roe", inputs, ctx, targetRoe, options);
}

/** O negócio é válido quando o retorno anualizado do cenário atinge o alvo. */
export function meetsTarget(o: Pick<ScenarioOutputs, "annualized">, target: number): boolean {
  return o.annualized >= target - 1e-9;
}

/** Valores por defeito de um cenário (os do Excel da LOOP). */
export const DEFAULT_INPUTS: ScenarioInputs = {
  salePrice: 0,
  saleCommissionPct: 0.05,
  commissionVatPct: 0.23,
  saleCpcvCost: 0,
  marketingCost: 0,
  earlyRepaymentPct: 0.005,

  purchasePrice: 0,
  vpt: 0,
  imtRegime: "isento",
  imtOverride: null,
  stampDutyPct: 0.008,
  deedCost: 500,
  registrationCost: 225,
  cpcvCost: 0,
  acquisitionCommission: 0,
  otherAcquisition: 0,

  ltvPct: 0,
  termYears: 40,
  interestRate: 0.04,
  feeDossier: 300,
  feeValuation: 250,
  feeFormalization: 700,
  stampDutyFinancingPct: 0.006,
  mortgageRegistration: 250,

  worksMethod: "manual",
  worksBudget: 0,
  worksCostPerM2: 600,
  grossArea: 0,
  worksVatPct: 0.23,
  contingencyPct: 0,
  architectureCost: 0,
  licensesCost: 0,
  supervisionCost: 0,
  otherWorks: 0,
  worksFinancedPct: 0,
  worksTermYears: 40,
  worksInterestRate: 0.04,
  worksFeeDossier: 300,
  worksFeeFormalization: 700,
  worksMortgageRegistration: 250,
  worksTranches: 2,
  worksTrancheCost: 150,

  holdingMonths: 6,
  insuranceMonth: 30,
  condoMonth: 30,
  electricityMonth: 40,
  waterMonth: 40,
  imi: 0,
  otherHolding: 0,

  taxRegime: "empresa",
  ircPct: 0.19,
  irsPct: 0.48,
};
