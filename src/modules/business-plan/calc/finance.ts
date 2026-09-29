/**
 * Funções financeiras puras. Sem dependências, sem I/O: correm no browser e
 * no servidor e são testadas contra o Excel da LOOP.
 */

/** Prestação constante (Excel PMT com sinal positivo). rate por período, n períodos, pv capital. */
export function pmt(rate: number, n: number, pv: number): number {
  if (pv <= 0 || n <= 0) return 0;
  if (rate === 0) return pv / n;
  return (pv * rate) / (1 - Math.pow(1 + rate, -n));
}

/**
 * Juros pagos entre os períodos `start` e `end` (inclusive), como o Excel
 * CUMIPMT com sinal positivo. Itera a amortização; para prazos de 40 anos
 * são 480 iterações, irrelevante.
 */
export function cumipmt(rate: number, n: number, pv: number, start: number, end: number): number {
  if (pv <= 0 || n <= 0 || end < start) return 0;
  const payment = pmt(rate, n, pv);
  let balance = pv;
  let interest = 0;
  for (let period = 1; period <= Math.min(end, n); period++) {
    const i = balance * rate;
    if (period >= start) interest += i;
    balance -= payment - i;
  }
  return interest;
}

export type ImtBracket = {
  lower: number;
  upper: number | null;
  rate: number;
  deduction: number;
};

/** IMT = base × taxa marginal − parcela a abater, no escalão onde a base cai. */
export function calcImt(base: number, brackets: ImtBracket[]): number {
  if (base <= 0 || brackets.length === 0) return 0;
  const sorted = [...brackets].sort((a, b) => a.lower - b.lower);
  let bracket = sorted[0]!;
  for (const b of sorted) {
    if (base >= b.lower) bracket = b;
  }
  const value = base * bracket.rate - bracket.deduction;
  return Math.max(0, round2(value));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
