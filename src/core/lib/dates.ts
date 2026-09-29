/**
 * Aritmética de datas em formato ISO (YYYY-MM-DD) sem fuso horário: usa UTC
 * para "2026-09-01 + 1 mês" nunca virar "2026-09-30" por causa do relógio local.
 */

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return [y!, m! - 1, d!];
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  return toIso(new Date(Date.UTC(y, m, d + days)));
}

export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  return toIso(new Date(Date.UTC(y, m + months, d)));
}

export function firstOfMonthIso(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function nextMonthIso(iso: string): string {
  const [y, m] = parts(iso);
  return toIso(new Date(Date.UTC(y, m + 1, 1)));
}

/** Hoje em ISO, no fuso local do servidor/browser. */
export function todayIso(): string {
  const d = new Date();
  return toIso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}
