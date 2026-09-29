/** Cálculo puro dos autos de medição. */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type LeafForMeasurement = {
  budgetLineId: string;
  budgeted: number;
  /** % acumulada no último auto fechado (0 se nunca medido). */
  previousPct: number;
  /** € acumulado no último auto fechado. */
  previousAmount: number;
};

export type MeasurementInput = { budgetLineId: string; pctCumulative: number };

export type MeasurementLineResult = {
  budgetLineId: string;
  pctCumulative: number;
  amountCumulative: number;
  amountPeriod: number;
};

export function calcMeasurement(leaves: LeafForMeasurement[], inputs: MeasurementInput[]) {
  const pctById = new Map(inputs.map((i) => [i.budgetLineId, i.pctCumulative]));
  const lines: MeasurementLineResult[] = leaves.map((l) => {
    const pct = Math.min(1, Math.max(0, pctById.get(l.budgetLineId) ?? l.previousPct));
    const amountCumulative = r2(l.budgeted * pct);
    return {
      budgetLineId: l.budgetLineId,
      pctCumulative: pct,
      amountCumulative,
      amountPeriod: r2(amountCumulative - l.previousAmount),
    };
  });
  const totalCumulative = r2(lines.reduce((a, l) => a + l.amountCumulative, 0));
  const totalPeriod = r2(lines.reduce((a, l) => a + l.amountPeriod, 0));
  const totalBudget = r2(leaves.reduce((a, l) => a + l.budgeted, 0));
  return { lines, totalCumulative, totalPeriod, totalBudget, progress: totalBudget > 0 ? totalCumulative / totalBudget : 0 };
}

export { firstOfMonthIso as firstOfMonth, nextMonthIso as nextMonth } from "@/core/lib/dates";

/** "setembro de 2026" → "Setembro de 2026". */
export function monthLabel(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
