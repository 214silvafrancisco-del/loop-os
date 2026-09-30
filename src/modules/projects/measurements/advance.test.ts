import { describe, expect, it } from "vitest";
import { advancePctFrom, suggestAdvancePct, workInvoiceNet } from "./advance";

describe("adiantamento", () => {
  it("cenário obrigatório: adjudicação 100 000, adiantamento 33 000 (33 %)", () => {
    const pct = suggestAdvancePct(33000, 100000);
    expect(pct).toBeCloseTo(0.33, 10);
    expect(workInvoiceNet(50000, pct)).toBe(33500);
    expect(workInvoiceNet(20000, pct)).toBe(13400);
    expect(workInvoiceNet(30000, pct)).toBe(20100);
    // totais
    expect(33500 + 13400 + 20100).toBe(67000);
    expect(33000 + 67000).toBe(100000);
  });

  it("sem adiantamento a fatura é igual ao auto", () => {
    expect(workInvoiceNet(50000, 0)).toBe(50000);
    expect(advancePctFrom([{ kind: "trabalho", status: "closed", number: 1, advancePct: null }])).toBe(0);
  });

  it("20 % de adiantamento", () => {
    expect(workInvoiceNet(50000, 0.2)).toBe(40000);
  });

  it("percentagem em vigor: último auto de adiantamento fechado", () => {
    const reports = [
      { kind: "adiantamento" as const, status: "closed" as const, number: 0, advancePct: 0.33 },
      { kind: "trabalho" as const, status: "closed" as const, number: 1, advancePct: null },
      { kind: "adiantamento" as const, status: "draft" as const, number: 2, advancePct: 0.5 },
    ];
    expect(advancePctFrom(reports)).toBe(0.33);
  });

  it("arredonda a dois cêntimos e limita a percentagem a 0–1", () => {
    expect(workInvoiceNet(1234.56, 0.333)).toBe(823.45);
    expect(workInvoiceNet(100, 1.5)).toBe(0);
    expect(workInvoiceNet(100, -1)).toBe(100);
    expect(suggestAdvancePct(1000, 0)).toBe(0);
  });
});
