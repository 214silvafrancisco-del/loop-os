const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurCents = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("pt-PT", { style: "percent", maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" });

type Num = number | string | null | undefined;

export function toNumber(v: Num): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** € sem cêntimos (valores de imóveis). */
export function formatCurrency(v: Num): string {
  const n = toNumber(v);
  return n === null ? "—" : eur.format(n);
}

/** € com cêntimos (faturas, custos). */
export function formatMoney(v: Num): string {
  const n = toNumber(v);
  return n === null ? "—" : eurCents.format(n);
}

export function formatArea(v: Num): string {
  const n = toNumber(v);
  return n === null ? "—" : `${num.format(n)} m²`;
}

/** Fração (0.25) → "25 %". */
export function formatPercent(v: Num): string {
  const n = toNumber(v);
  return n === null ? "—" : pct.format(n);
}

export function formatNumber(v: Num): string {
  const n = toNumber(v);
  return n === null ? "—" : num.format(n);
}

export function formatDate(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/** Remove acentos, pontuação e espaços repetidos; minúsculas. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
