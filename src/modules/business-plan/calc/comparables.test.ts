/** Folha "Avaliações" do BP_Benficat4.xlsx: imóvel de 129 m², 4 comparáveis. */
import { describe, expect, it } from "vitest";
import { calcComparable, calcValuation, defaultAreaAdjustment, type ComparableInput } from "./comparables";

const BASE_AREA = 129;
const PCT_PER_M2 = 0.0025; // 0,25 % por m²

function comp(price: number, area: number, adj: Partial<ComparableInput> = {}): ComparableInput {
  return {
    price,
    area,
    adjNegotiation: -0.05,
    adjArea: defaultAreaAdjustment(area, BASE_AREA, PCT_PER_M2),
    adjLocation: 0,
    adjAge: 0,
    adjCondition: 0,
    adjOther: 0,
    isIncluded: true,
    ...adj,
  };
}

const excel = [
  comp(895000, 264, { adjCondition: -0.25 }),
  comp(795000, 180, { adjCondition: -0.25 }),
  comp(599900, 96, { adjLocation: -0.1, adjCondition: -0.25, adjOther: 0.1 }),
  comp(550000, 117, { adjLocation: -0.05, adjOther: 0.1 }),
];

describe("comparáveis (folha Avaliações)", () => {
  it("ajuste de área por defeito", () => {
    expect(defaultAreaAdjustment(264, 129, PCT_PER_M2)).toBeCloseTo(-0.3375, 6); // D34
    expect(defaultAreaAdjustment(96, 129, PCT_PER_M2)).toBeCloseTo(0.0825, 6); // H34
  });

  it("€/m² e homogeneização por comparável", () => {
    const r = excel.map(calcComparable);
    expect(r[0]!.pricePerM2).toBeCloseTo(3390.15, 2); // D23
    expect(r[0]!.totalAdjustment).toBeCloseTo(-0.6375, 6); // D39
    expect(r[0]!.adjustedPricePerM2).toBeCloseTo(1228.93, 2); // D40
    expect(r[1]!.adjustedPricePerM2).toBeCloseTo(2528.54, 2); // F40
    expect(r[2]!.adjustedPricePerM2).toBeCloseTo(4889.81, 2); // H40
    expect(r[3]!.adjustedPricePerM2).toBeCloseTo(4841.88, 2); // J40
  });

  it("média e avaliação", () => {
    const v = calcValuation(excel, BASE_AREA);
    expect(v.includedCount).toBe(4);
    expect(v.averagePricePerM2).toBeCloseTo(3372.29, 2); // D45
    expect(v.valuation).toBeCloseTo(435025.47, 0); // D8
  });

  it("comparáveis excluídos ou sem área não entram na média", () => {
    const v = calcValuation([...excel, comp(1000000, 0), { ...comp(100000, 50), isIncluded: false }], BASE_AREA);
    expect(v.includedCount).toBe(4);
    expect(v.averagePricePerM2).toBeCloseTo(3372.29, 2);
  });
});
