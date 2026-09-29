import { z } from "zod";

const money = z.number().min(0).max(1e9);
const pct = z.number().min(0).max(1);
const months = z.number().int().min(0).max(600);
const years = z.number().int().min(1).max(50);

/** Inputs de cenário enviados pelo cliente (JSON numérico). */
export const scenarioInputsSchema = z.object({
  salePrice: money,
  saleCommissionPct: pct,
  commissionVatPct: pct,
  saleCpcvCost: money,
  marketingCost: money,
  earlyRepaymentPct: pct,

  purchasePrice: money,
  vpt: money,
  imtRegime: z.enum(["isento", "hpp", "hs"]),
  imtOverride: money.nullable(),
  stampDutyPct: pct,
  deedCost: money,
  registrationCost: money,
  cpcvCost: money,
  acquisitionCommission: money,
  otherAcquisition: money,

  ltvPct: pct,
  termYears: years,
  interestRate: pct,
  feeDossier: money,
  feeValuation: money,
  feeFormalization: money,
  stampDutyFinancingPct: pct,
  mortgageRegistration: money,

  worksMethod: z.enum(["manual", "per_m2"]),
  worksBudget: money,
  worksCostPerM2: money,
  grossArea: money,
  worksVatPct: pct,
  contingencyPct: pct,
  architectureCost: money,
  licensesCost: money,
  supervisionCost: money,
  otherWorks: money,
  worksFinancedPct: pct,
  worksTermYears: years,
  worksInterestRate: pct,
  worksFeeDossier: money,
  worksFeeFormalization: money,
  worksMortgageRegistration: money,
  worksTranches: z.number().int().min(0).max(50),
  worksTrancheCost: money,

  holdingMonths: months,
  insuranceMonth: money,
  condoMonth: money,
  electricityMonth: money,
  waterMonth: money,
  imi: money,
  otherHolding: money,

  taxRegime: z.enum(["empresa", "particular"]),
  ircPct: pct,
  irsPct: pct,
});

export const SCENARIO_KIND_LABEL = {
  ato_continuo: "Ato Contínuo",
  remodelacao: "Remodelação",
  custom: "Personalizado",
} as const;
