import { describe, expect, it } from "vitest";
import { calcMeasurement, firstOfMonth, nextMonth } from "./calc";

describe("autos de medição", () => {
  const leaves = [
    { budgetLineId: "a", budgeted: 3000, previousPct: 0.5, previousAmount: 1500 },
    { budgetLineId: "b", budgeted: 1100, previousPct: 0, previousAmount: 0 },
    { budgetLineId: "c", budgeted: 700, previousPct: 1, previousAmount: 700 },
  ];

  it("acumulado e período por artigo", () => {
    const r = calcMeasurement(leaves, [
      { budgetLineId: "a", pctCumulative: 0.8 },
      { budgetLineId: "b", pctCumulative: 0.25 },
    ]);
    expect(r.lines[0]).toEqual({ budgetLineId: "a", pctCumulative: 0.8, amountCumulative: 2400, amountPeriod: 900 });
    expect(r.lines[1]).toEqual({ budgetLineId: "b", pctCumulative: 0.25, amountCumulative: 275, amountPeriod: 275 });
    // sem input mantém a % anterior
    expect(r.lines[2]).toEqual({ budgetLineId: "c", pctCumulative: 1, amountCumulative: 700, amountPeriod: 0 });
    expect(r.totalCumulative).toBe(3375);
    expect(r.totalPeriod).toBe(1175);
    expect(r.totalBudget).toBe(4800);
    expect(r.progress).toBeCloseTo(3375 / 4800, 6);
  });

  it("percentagem fora de 0–1 é limitada", () => {
    const r = calcMeasurement(leaves, [{ budgetLineId: "a", pctCumulative: 1.4 }, { budgetLineId: "b", pctCumulative: -1 }]);
    expect(r.lines[0]!.pctCumulative).toBe(1);
    expect(r.lines[1]!.pctCumulative).toBe(0);
  });

  it("meses", () => {
    expect(firstOfMonth("2026-09-29")).toBe("2026-09-01");
    expect(nextMonth("2026-12-15")).toBe("2027-01-01");
  });
});
