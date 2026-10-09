import { describe, expect, it } from "vitest";
import { averages, conversionRates, ewma, forecastPurchases, poissonQuantile, type FunnelWeek } from "./forecast";
import { isCompleteWeek, recentWeekStarts, weekLabel, weekStartOf } from "./weeks";

function week(i: number, v: Partial<FunnelWeek>): FunnelWeek {
  const d = new Date("2026-01-05T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 7 * i);
  return { weekStart: d.toISOString().slice(0, 10), leads: 20, visits: 10, proposals: 5, purchases: 1, ...v };
}

const steady = Array.from({ length: 20 }, (_, i) => week(i, { purchases: i % 2 }));

describe("semanas", () => {
  it("segunda-feira da semana e etiqueta", () => {
    expect(weekStartOf("2026-10-01")).toBe("2026-09-28"); // quinta → segunda
    expect(weekStartOf("2026-10-04")).toBe("2026-09-28"); // domingo
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05"); // segunda
    expect(weekLabel("2026-09-28")).toBe("28/09 – 04/10");
    expect(recentWeekStarts("2026-10-01", 3)).toEqual(["2026-09-28", "2026-09-21", "2026-09-14"]);
    expect(isCompleteWeek("2026-09-28", "2026-10-01")).toBe(false);
    expect(isCompleteWeek("2026-09-21", "2026-10-01")).toBe(true);
  });
});

describe("estatística de base", () => {
  it("EWMA pesa mais o recente", () => {
    expect(ewma([0, 0, 0, 4], 1)!).toBeGreaterThan(2);
    expect(ewma([4, 0, 0, 0], 1)!).toBeLessThan(1);
    expect(ewma([], 4)).toBeNull();
  });
  it("quantis de Poisson", () => {
    expect(poissonQuantile(0, 0.9)).toBe(0);
    expect(poissonQuantile(1, 0.1)).toBe(0);
    expect(poissonQuantile(1, 0.9)).toBe(2);
    expect(poissonQuantile(13, 0.9)).toBeGreaterThanOrEqual(17);
  });
  it("rácios agregados ignoram semanas incompletas e não assumem desfasamento", () => {
    const c = conversionRates([week(0, { leads: 10, purchases: 1 }), week(1, { leads: 30, purchases: 1 }), week(2, { leads: null, purchases: 5 })]);
    expect(c.purchasesPerLead).toBeCloseTo(2 / 40, 6);
    expect(averages([week(0, { leads: 10 }), week(1, { leads: null })]).leads).toBe(10);
  });
});

describe("previsão de compras", () => {
  it("com menos de 4 semanas não prevê", () => {
    const f = forecastPurchases(steady.slice(0, 3));
    expect(f.status).toBe("insufficient");
    if (f.status === "insufficient") expect(f.minimumWeeks).toBe(4);
  });

  it("ritmo estável ≈ 0,5 compras/semana; horizontes multiplicam; intervalos envolvem o esperado", () => {
    const f = forecastPurchases(steady);
    expect(f.status).toBe("ok");
    if (f.status !== "ok") return;
    expect(f.weeklyRate).toBeGreaterThan(0.4);
    expect(f.weeklyRate).toBeLessThan(0.6);
    expect(f.fourWeeks.expected).toBe(Math.round(f.weeklyRate * 4));
    expect(f.threeMonths.expected).toBe(Math.round(f.weeklyRate * 13));
    expect(f.threeMonths.low).toBeLessThanOrEqual(f.threeMonths.expected);
    expect(f.threeMonths.high).toBeGreaterThanOrEqual(f.threeMonths.expected);
    expect(f.reliability).toBe("boa");
    expect(f.trend?.direction).toBe("flat");
  });

  it("alterar uma semana recente altera a previsão (recálculo)", () => {
    const before = forecastPurchases(steady);
    const changed = steady.map((w, i) => (i === 19 ? { ...w, purchases: 4 } : w));
    const after = forecastPurchases(changed);
    if (before.status !== "ok" || after.status !== "ok") throw new Error("esperava ok");
    expect(after.weeklyRate).toBeGreaterThan(before.weeklyRate);
  });

  it("um salto de leads nunca vira compra garantida: ajuste limitado a ±50 %", () => {
    const boom = steady.map((w, i) => (i >= 16 ? { ...w, leads: 200, proposals: 50 } : w));
    const f = forecastPurchases(boom);
    if (f.status !== "ok") throw new Error("esperava ok");
    expect(f.funnelRate).not.toBeNull();
    expect(f.funnelRate!).toBeLessThanOrEqual(f.baseRate * 1.5 + 1e-9);
    expect(f.weeklyRate).toBeLessThanOrEqual(f.baseRate * 1.5 + 1e-9);
  });

  it("com 4 a 7 semanas a fiabilidade é baixa e o funil não entra", () => {
    const f = forecastPurchases(steady.slice(0, 6));
    if (f.status !== "ok") throw new Error("esperava ok");
    expect(f.reliability).toBe("baixa");
    expect(f.funnelRate).toBeNull();
    expect(f.funnelWeight).toBe(0);
  });

  it("tendência de subida quando as últimas 4 semanas superam as 8 anteriores", () => {
    const rising = steady.map((w, i) => ({ ...w, purchases: i >= 16 ? 3 : 1 }));
    const f = forecastPurchases(rising);
    if (f.status !== "ok") throw new Error("esperava ok");
    expect(f.trend?.direction).toBe("up");
    expect(f.weeklyRate).toBeGreaterThan(1);
  });

  it("lacunas e irregularidade baixam a fiabilidade", () => {
    const gappy = steady.map((w, i) => (i % 3 === 0 ? { ...w, purchases: null } : w));
    const f = forecastPurchases(gappy);
    if (f.status !== "ok") throw new Error("esperava ok");
    expect(f.reliability).not.toBe("boa");
    expect(f.reliabilityNotes.length).toBeGreaterThan(0);
  });
});
