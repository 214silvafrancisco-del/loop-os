/**
 * Testes contra o Excel BP_Benficat4.xlsx (folhas Compra&Revenda e IMT).
 * Cenário 1 = Ato Contínuo, Cenário 2 = Remodelação.
 *
 * Nota: no Excel, algumas fórmulas do Cenário 2 (F13, F22, F23) referem por
 * engano células do Cenário 1 (v.compra.C1, cT.aquis.C1…). Os valores
 * esperados do Cenário 2 abaixo são os corrigidos; os do Cenário 1 batem
 * com o Excel tal como está.
 */
import { describe, expect, it } from "vitest";
import { calcImt, cumipmt, pmt, type ImtBracket } from "./finance";
import { calcScenario, DEFAULT_INPUTS, maxPurchasePriceForRoe, type CalcContext, type ScenarioInputs } from "./scenario";

const HPP_2026: ImtBracket[] = [
  { lower: 0, upper: 106346, rate: 0, deduction: 0 },
  { lower: 106346, upper: 145470, rate: 0.02, deduction: 2126.92 },
  { lower: 145470, upper: 198347, rate: 0.05, deduction: 6491.02 },
  { lower: 198347, upper: 330539, rate: 0.07, deduction: 10457.96 },
  { lower: 330539, upper: 666982, rate: 0.08, deduction: 13763.35 },
  { lower: 666982, upper: 1150853, rate: 0.06, deduction: 0 },
  { lower: 1150853, upper: null, rate: 0.075, deduction: 0 },
];
const HS_2026: ImtBracket[] = [
  { lower: 0, upper: 106346, rate: 0.01, deduction: 0 },
  { lower: 106346, upper: 145470, rate: 0.02, deduction: 1063.46 },
  { lower: 145470, upper: 198347, rate: 0.05, deduction: 5427.56 },
  { lower: 198347, upper: 330539, rate: 0.07, deduction: 9394.5 },
  { lower: 330539, upper: 633931, rate: 0.08, deduction: 12699.89 },
  { lower: 633931, upper: 1150853, rate: 0.06, deduction: 0 },
  { lower: 1150853, upper: null, rate: 0.075, deduction: 0 },
];
const ctx: CalcContext = { imtBrackets: { hpp: HPP_2026, hs: HS_2026 } };

/** Inputs do Excel: sem IS na aquisição (célula em branco), sem penalizações com financiamento 0. */
const excelBase: ScenarioInputs = {
  ...DEFAULT_INPUTS,
  vpt: 42140,
  imtRegime: "isento",
  stampDutyPct: 0,
  deedCost: 500,
  registrationCost: 225,
  insuranceMonth: 30,
  condoMonth: 30,
  electricityMonth: 40,
  waterMonth: 40,
  taxRegime: "empresa",
  ircPct: 0.19,
};

describe("funções financeiras", () => {
  it("pmt e cumipmt batem com o Excel", () => {
    // PMT(4%/12, 480, 100000) = 417.94 ; CUMIPMT(…, 1, 6) = 1995.75
    expect(pmt(0.04 / 12, 480, 100000)).toBeCloseTo(417.94, 2);
    expect(cumipmt(0.04 / 12, 480, 100000, 1, 6)).toBeCloseTo(1995.75, 1);
    expect(pmt(0.04 / 12, 480, 0)).toBe(0);
  });

  it("IMT por escalões (folha IMT)", () => {
    expect(calcImt(265000, HPP_2026)).toBeCloseTo(8092.04, 2);
    expect(calcImt(265000, HS_2026)).toBeCloseTo(9155.5, 2);
    expect(calcImt(445000, HPP_2026)).toBeCloseTo(21836.65, 2);
    expect(calcImt(445000, HS_2026)).toBeCloseTo(22900.11, 2);
    expect(calcImt(100000, HPP_2026)).toBe(0);
    expect(calcImt(700000, HPP_2026)).toBeCloseTo(42000, 2);
  });
});

describe("Cenário 1 · Ato Contínuo (BP_Benficat4)", () => {
  const c1 = calcScenario(
    {
      ...excelBase,
      salePrice: 275000,
      purchasePrice: 265000,
      worksMethod: "manual",
      worksBudget: 0,
      holdingMonths: 1,
      saleCommissionPct: 0.01,
    },
    ctx,
  );

  it("aquisição, obra, detenção e venda", () => {
    expect(c1.imt).toBe(0);
    expect(c1.acquisitionTotal).toBeCloseTo(265725, 2); // D42
    expect(c1.worksTotal).toBe(0); // D76
    expect(c1.holdingCosts).toBeCloseTo(140, 2); // D87
    expect(c1.commission).toBeCloseTo(3382.5, 2); // D92
    expect(c1.saleCosts).toBeCloseTo(3382.5, 1); // D98 (Excel 3382.51)
  });

  it("resumo", () => {
    expect(c1.totalCosts).toBeCloseTo(4247.5, 1); // D15
    expect(c1.equity).toBeCloseTo(265865, 1); // D13
    expect(c1.grossProfit).toBeCloseTo(5752.5, 1); // D18
    expect(c1.tax).toBeCloseTo(1092.98, 1); // D107
    expect(c1.netProfit).toBeCloseTo(4659.52, 1); // D19
    expect(c1.roi).toBeCloseTo(0.021365, 5); // D22
    expect(c1.roe).toBeCloseTo(0.021637, 5); // D23
    expect(c1.annualized).toBeCloseTo(0.25638, 4); // D24
  });
});

describe("Cenário 2 · Remodelação (BP_Benficat4, fórmulas corrigidas)", () => {
  const c2 = calcScenario(
    {
      ...excelBase,
      salePrice: 600000,
      purchasePrice: 445000,
      worksMethod: "manual",
      worksBudget: 50000,
      worksVatPct: 0.23, // fora de ARU
      holdingMonths: 6,
      saleCommissionPct: 0.05,
    },
    ctx,
  );

  it("blocos", () => {
    expect(c2.acquisitionTotal).toBeCloseTo(445725, 2); // F42
    expect(c2.worksWithVat).toBeCloseTo(61500, 2); // F63
    expect(c2.worksTotal).toBeCloseTo(61500, 2); // F76
    expect(c2.holdingCosts).toBeCloseTo(840, 2); // F87
    expect(c2.commission).toBeCloseTo(36900, 2); // F92
  });

  it("resumo", () => {
    expect(c2.totalCosts).toBeCloseTo(99965, 1); // F15
    expect(c2.grossProfit).toBeCloseTo(55035, 1); // F18
    expect(c2.tax).toBeCloseTo(10456.65, 1); // F107
    expect(c2.netProfit).toBeCloseTo(44578.35, 1); // F19
    // Corrigidos (o Excel usa células do cenário 1 aqui):
    expect(c2.equity).toBeCloseTo(508065, 1);
    expect(c2.roi).toBeCloseTo(55035 / 544965, 5);
    expect(c2.roe).toBeCloseTo(55035 / 508065, 5);
    expect(c2.annualized).toBeCloseTo((55035 / 544965) * 2, 5);
  });

  it("IVA de obra a 6 % em zona ARU", () => {
    const aru = calcScenario({ ...excelBase, salePrice: 600000, purchasePrice: 445000, worksBudget: 50000, worksVatPct: 0.06, holdingMonths: 6 }, ctx);
    expect(aru.worksWithVat).toBeCloseTo(53000, 2);
  });

  it("método €/m²", () => {
    const m2 = calcScenario({ ...excelBase, salePrice: 600000, purchasePrice: 445000, worksMethod: "per_m2", grossArea: 100, worksCostPerM2: 600, worksVatPct: 0.23, holdingMonths: 6 }, ctx);
    expect(m2.worksNet).toBeCloseTo(60000, 2); // D62
    expect(m2.worksWithVat).toBeCloseTo(73800, 2);
  });
});

describe("financiamento", () => {
  it("custos, prestação e juros durante a detenção", () => {
    const f = calcScenario(
      { ...excelBase, salePrice: 600000, purchasePrice: 445000, ltvPct: 0.8, termYears: 40, interestRate: 0.04, holdingMonths: 6, worksBudget: 50000 },
      ctx,
    );
    expect(f.financedAmount).toBeCloseTo(356000, 2);
    expect(f.monthlyPayment).toBeCloseTo(pmt(0.04 / 12, 480, 356000), 2);
    // dossier 300 + avaliação 250 + formalização 700 + IS 0,6 % (2136) + hipoteca 250
    expect(f.financingCosts).toBeCloseTo(3636, 2);
    expect(f.interestProperty).toBeCloseTo(cumipmt(0.04 / 12, 480, 356000, 1, 6), 2);
    expect(f.holdingCosts).toBeCloseTo(840 + f.interestProperty, 2);
    // penalização 0,5 % sobre o capital em dívida aproximado
    expect(f.earlyRepaymentPenalty).toBeCloseTo(0.005 * (356000 - 6 * f.monthlyPayment), 2);
    expect(f.equity).toBeCloseTo(f.totalInvestment - f.saleCosts - 356000, 2);
    expect(f.financing).toBeCloseTo(356000, 2);
  });

  it("financiamento da obra soma comissões e tranches ao custo da obra", () => {
    const f = calcScenario({ ...excelBase, salePrice: 600000, purchasePrice: 445000, worksBudget: 50000, worksFinancedPct: 1, worksTranches: 2 }, ctx);
    // 61500 + dossier 300 + formalização 700 + IS 0,6 % de 61500 (369) + hipoteca 250 + 2×150
    expect(f.worksTotal).toBeCloseTo(61500 + 300 + 700 + 369 + 250 + 300, 2);
  });
});

describe("resultados derivados", () => {
  const base: ScenarioInputs = { ...excelBase, salePrice: 600000, purchasePrice: 445000, worksBudget: 50000, holdingMonths: 6, saleCommissionPct: 0.05, grossArea: 129 };

  it("IRS para particular incide sobre 50 % do lucro", () => {
    const p = calcScenario({ ...base, taxRegime: "particular", irsPct: 0.48 }, ctx);
    expect(p.tax).toBeCloseTo(55035 * 0.5 * 0.48, 1);
  });

  it("break-even: vender a esse preço dá lucro bruto zero", () => {
    const r = calcScenario(base, ctx);
    const be = calcScenario({ ...base, salePrice: r.breakEvenPrice }, ctx);
    expect(be.grossProfit).toBeCloseTo(0, 0);
  });

  it("lucro por m²", () => {
    const r = calcScenario(base, ctx);
    expect(r.profitPerM2).toBeCloseTo(55035 / 129, 1);
  });

  it("preço máximo para ROE alvo", () => {
    const max = maxPurchasePriceForRoe(base, ctx, 0.2);
    expect(max).not.toBeNull();
    const at = calcScenario({ ...base, purchasePrice: max! }, ctx);
    expect(at.roe).toBeGreaterThanOrEqual(0.2);
    expect(calcScenario({ ...base, purchasePrice: max! + 1000 }, ctx).roe).toBeLessThan(0.2);
  });

  it("prejuízo não paga imposto", () => {
    const loss = calcScenario({ ...base, salePrice: 400000 }, ctx);
    expect(loss.grossProfit).toBeLessThan(0);
    expect(loss.tax).toBe(0);
    expect(loss.netProfit).toBe(loss.grossProfit);
  });
});
