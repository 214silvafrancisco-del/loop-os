import { z } from "zod";

/** Helpers zod para formulários HTML: tudo chega como string, "" significa vazio. */

export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/** "" → null; "123,45" → "123.45" (string, para colunas numeric do Drizzle). */
export const optionalDecimal = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    const plain = Number(v.replace(/\s/g, "").replace(",", "."));
    // Aceita "250000", "250 000", "250.000,50" e "250000.50".
    const value = Number.isFinite(plain) ? plain : n;
    if (!Number.isFinite(value) || value < 0) {
      ctx.addIssue({ code: "custom", message: "Valor inválido." });
      return z.NEVER;
    }
    return value.toFixed(2);
  })
  .nullable()
  .optional();

/** Percentagem escrita como "5" ou "5,5" → fração "0.0550". */
export const optionalPercent = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v.replace(",", ".").replace("%", ""));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Percentagem inválida." });
      return z.NEVER;
    }
    return (n / 100).toFixed(4);
  })
  .nullable()
  .optional();

export const optionalInt = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Número inteiro inválido." });
      return z.NEVER;
    }
    return n;
  })
  .nullable()
  .optional();

/** "2026-09-29" (input type=date) → string ISO ou null. */
export const optionalDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return v;
  })
  .nullable()
  .optional();

export const optionalUrl = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      new URL(withScheme);
      return withScheme;
    } catch {
      ctx.addIssue({ code: "custom", message: "Link inválido." });
      return z.NEVER;
    }
  })
  .nullable()
  .optional();

export const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid("Escolha inválida.").nullable())
  .nullable()
  .optional();

export function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Lê um FormData para um objeto de strings com as chaves indicadas. */
export function stringsFromForm<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = String(formData.get(k) ?? "");
  return out;
}
