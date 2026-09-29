import { round2 } from "./finance";

/** Um comparável com os ajustes de homogeneização (fração com sinal). */
export type ComparableInput = {
  price: number;
  area: number;
  adjNegotiation: number;
  adjArea: number;
  adjLocation: number;
  adjAge: number;
  adjCondition: number;
  adjOther: number;
  isIncluded: boolean;
};

export type ComparableResult = {
  pricePerM2: number;
  totalAdjustment: number;
  adjustedPricePerM2: number;
};

export type ValuationResult = {
  perComparable: ComparableResult[];
  /** Média dos €/m² ajustados dos comparáveis incluídos (Excel AVERAGEIF <>0). */
  averagePricePerM2: number;
  includedCount: number;
  /** Média × área bruta do imóvel. */
  valuation: number;
};

export function pricePerM2(price: number, area: number): number {
  return area > 0 ? price / area : 0;
}

/**
 * Ajuste de área por defeito, como no Excel:
 * −(área do comparável − área do imóvel) × pctPorM2. Comparável maior ⇒ ajuste negativo.
 */
export function defaultAreaAdjustment(comparableArea: number, baseArea: number, pctPerM2: number): number {
  if (baseArea <= 0 || comparableArea <= 0) return 0;
  return -(comparableArea - baseArea) * pctPerM2;
}

export function calcComparable(c: ComparableInput): ComparableResult {
  const ppm2 = pricePerM2(c.price, c.area);
  const total = c.adjNegotiation + c.adjArea + c.adjLocation + c.adjAge + c.adjCondition + c.adjOther;
  return {
    pricePerM2: round2(ppm2),
    totalAdjustment: total,
    adjustedPricePerM2: round2(ppm2 * (1 + total)),
  };
}

export function calcValuation(comparables: ComparableInput[], baseArea: number): ValuationResult {
  const perComparable = comparables.map(calcComparable);
  const included = perComparable.filter((r, i) => comparables[i]!.isIncluded && r.adjustedPricePerM2 > 0);
  const average = included.length ? included.reduce((a, r) => a + r.adjustedPricePerM2, 0) / included.length : 0;
  return {
    perComparable,
    averagePricePerM2: round2(average),
    includedCount: included.length,
    valuation: round2(average * baseArea),
  };
}
