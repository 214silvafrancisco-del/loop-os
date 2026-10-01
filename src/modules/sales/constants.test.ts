import { describe, expect, it } from "vitest";
import { commissionAmount, daysOnMarket, dealStatusForStage, propertyStatusForStage } from "./constants";

describe("vendas: fases e estados derivados", () => {
  it("fase da venda define o estado do imóvel", () => {
    expect(propertyStatusForStage("preparacao")).toBe("owned");
    expect(propertyStatusForStage("a_venda")).toBe("for_sale");
    expect(propertyStatusForStage("cpcv")).toBe("for_sale");
    expect(propertyStatusForStage("vendido")).toBe("sold");
    expect(propertyStatusForStage("cancelada")).toBe("owned");
  });

  it("negócio de origem só fecha quando a venda é escriturada", () => {
    expect(dealStatusForStage("vendido")).toBe("sold");
    expect(dealStatusForStage("cpcv")).toBe("active");
    expect(dealStatusForStage("cancelada")).toBe("active");
  });
});

describe("comissão da mediadora", () => {
  it("percentagem sobre o preço, com IVA", () => {
    expect(commissionAmount(250000, { commissionPct: 0.05, commissionFixed: null, commissionVatPct: 0.23 })).toEqual({ net: 12500, vat: 2875, total: 15375 });
  });
  it("valor fixo ignora a percentagem", () => {
    expect(commissionAmount(250000, { commissionPct: 0.05, commissionFixed: 5000, commissionVatPct: 0.23 })).toEqual({ net: 5000, vat: 1150, total: 6150 });
  });
  it("sem preço nem valor fixo é zero", () => {
    expect(commissionAmount(null, { commissionPct: 0.05, commissionFixed: null, commissionVatPct: 0.23 }).total).toBe(0);
  });
});

describe("dias no mercado", () => {
  it("conta desde o anúncio até hoje ou até à escritura", () => {
    expect(daysOnMarket("2026-09-01", null, "2026-10-01")).toBe(30);
    expect(daysOnMarket("2026-09-01", "2026-09-21", "2026-10-01")).toBe(20);
    expect(daysOnMarket(null, null, "2026-10-01")).toBeNull();
  });
});
