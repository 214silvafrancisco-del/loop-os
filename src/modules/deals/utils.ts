/** Funções puras partilhadas entre servidor e cliente. */

export function dealRef(row: { ref: string; seq: number }): string {
  return row.seq > 1 ? `${row.ref}·${row.seq}` : row.ref;
}

/** "2" → "2.º"; "RC" fica "RC". */
export function floorLabel(floor: string | null | undefined): string | null {
  if (!floor) return null;
  return /^\d+$/.test(floor) ? `${floor}.º` : floor;
}

/** Data (YYYY-MM-DD) anterior a hoje. */
export function isOverdue(date: string | null | undefined): boolean {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(date + "T00:00:00").getTime() < today.getTime();
}

export function todayIso(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
