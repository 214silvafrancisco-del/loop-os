/** Aritmética de semanas (segunda a domingo) em UTC, sem surpresas de fuso. */

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana que contém `iso`. */
export function weekStartOf(iso: string): string {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = domingo
  return addDaysIso(iso, dow === 0 ? -6 : 1 - dow);
}

export function weekEndOf(weekStart: string): string {
  return addDaysIso(weekStart, 6);
}

/** As `n` semanas mais recentes (da atual para trás), como segundas-feiras. */
export function recentWeekStarts(today: string, n: number): string[] {
  const current = weekStartOf(today);
  return Array.from({ length: n }, (_, i) => addDaysIso(current, -7 * i));
}

/** "28/09 – 04/10" para cabeçalhos curtos. */
export function weekLabel(weekStart: string): string {
  const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${fmt(weekStart)} – ${fmt(weekEndOf(weekStart))}`;
}

/** Uma semana está completa quando o domingo já passou. */
export function isCompleteWeek(weekStart: string, today: string): boolean {
  return weekEndOf(weekStart) < today;
}
