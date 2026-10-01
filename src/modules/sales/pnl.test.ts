import { describe, expect, it } from "vitest";
import { buildPnl, monthsBetween, realSide, type RealInputs } from "./pnl";

const base: RealInputs = {
  purchasePrice: 200000,
  acquisitionCosts: 15000,
  worksInvoiced: 40000,
  holdingCosts: 2000,
  financingCosts: 3000,
  agencyCommissions: 16605,
  otherSaleCosts: 395,
  salePrice: 330000,
  listingPrice: 340000,
  taxRate: 0.19,
  purchaseDate: "2026-01-15",
  saleDate: "2026-09-15",
  today: "2026-10-01",
};

describe("P&L real", () => {
  it("soma custos, calcula lucro, imposto, margem, ROI e duração", () => {
    const { side, final } = realSide(base);
    expect(final).toBe(true);
    expect(side.totalInvestment).toBe(277000);
    expect(side.grossProfit).toBe(53000);
    expect(side.tax).toBe(10070);
    expect(side.netProfit).toBe(42930);
    expect(side.margin).toBeCloseTo(42930 / 330000, 6);
    expect(side.roi).toBeCloseTo(53000 / 277000, 6);
    expect(side.months).toBe(8);
  });

  it("sem escritura usa o preço anunciado como previsão e conta até hoje", () => {
    const { side, final } = realSide({ ...base, salePrice: null, saleDate: null });
    expect(final).toBe(false);
    expect(side.revenue).toBe(340000);
    expect(side.months).toBe(8.5);
  });

  it("prejuízo não paga imposto", () => {
    const { side } = realSide({ ...base, salePrice: 250000 });
    expect(side.grossProfit).toBe(-27000);
    expect(side.tax).toBe(0);
    expect(side.netProfit).toBe(-27000);
  });

  it("sem Business Plan as linhas ficam só com o real", () => {
    const p = buildPnl(null, base);
    expect(p.bp).toBeNull();
    expect(p.rows.find((r) => r.key === "netProfit")?.real).toBe(42930);
    expect(p.rows.find((r) => r.key === "netProfit")?.bp).toBeNull();
  });
});

describe("monthsBetween", () => {
  it("arredonda a décimas e nunca é negativo", () => {
    expect(monthsBetween("2026-01-01", "2026-04-01")).toBe(3);
    expect(monthsBetween("2026-01-01", "2026-01-16")).toBe(0.5);
    expect(monthsBetween("2026-05-01", "2026-04-01")).toBe(0);
    expect(monthsBetween(null, "2026-04-01")).toBeNull();
  });
});
