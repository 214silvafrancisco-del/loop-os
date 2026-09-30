/**
 * Adiantamento (puro): um auto de adiantamento guarda a percentagem; as
 * faturas dos autos de trabalho seguintes descontam-na.
 *
 *   Fatura de trabalho = valor do auto × (1 − % adiantamento)
 */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Percentagem em fração (0.33) a partir do valor do adiantamento e do adjudicado; 0 se não houver adjudicado. */
export function suggestAdvancePct(advanceAmount: number, awardedAmount: number): number {
  if (awardedAmount <= 0 || advanceAmount <= 0) return 0;
  return Math.min(1, advanceAmount / awardedAmount);
}

/** Líquido da fatura de um auto de trabalho, com a percentagem em fração (0.33). */
export function workInvoiceNet(workAmount: number, advancePct: number): number {
  const pct = Math.min(1, Math.max(0, advancePct));
  return r2(workAmount * (1 - pct));
}

/** Percentagem em vigor para um fornecedor: a do último auto de adiantamento fechado, ou 0. */
export function advancePctFrom(reports: { kind: "trabalho" | "adiantamento"; status: "draft" | "closed"; number: number; advancePct: number | null }[]): number {
  const advances = reports.filter((r) => r.kind === "adiantamento" && r.status === "closed").sort((a, b) => b.number - a.number);
  return advances[0]?.advancePct ?? 0;
}
