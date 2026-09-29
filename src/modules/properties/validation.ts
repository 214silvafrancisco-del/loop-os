import { z } from "zod";
import { normalizeText } from "@/core/lib/format";

export const PROPERTY_TYPES = ["apartamento", "predio", "moradia", "loja", "terreno", "outro"] as const;
export const PROPERTY_STATUSES = ["prospect", "owned", "for_sale", "sold"] as const;
export const PROPERTY_CONDITIONS = ["para_obras", "habitavel", "remodelado", "novo"] as const;
export const TYPOLOGIES = ["T0", "T1", "T2", "T3", "T4", "T5", "T6+"] as const;
export const ENERGY_CLASSES = ["A+", "A", "B", "B-", "C", "D", "E", "F"] as const;

export const PROPERTY_TYPE_LABEL: Record<(typeof PROPERTY_TYPES)[number], string> = {
  apartamento: "Apartamento",
  predio: "Prédio",
  moradia: "Moradia",
  loja: "Loja",
  terreno: "Terreno",
  outro: "Outro",
};

export const PROPERTY_STATUS_LABEL: Record<(typeof PROPERTY_STATUSES)[number], string> = {
  prospect: "Prospeção",
  owned: "Comprado",
  for_sale: "À venda",
  sold: "Vendido",
};

export const PROPERTY_CONDITION_LABEL: Record<(typeof PROPERTY_CONDITIONS)[number], string> = {
  para_obras: "Para obras",
  habitavel: "Habitável",
  remodelado: "Remodelado",
  novo: "Novo",
};

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/** "" → null; "123,45" → 123.45. Devolve string para colunas numeric do Drizzle. */
const optionalDecimal = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Valor inválido." });
      return z.NEVER;
    }
    return n.toFixed(2);
  })
  .nullable()
  .optional();

const optionalInt = z
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

/** Checkbox: presente → true; ausente → null (desconhecido), não false. */
const tri = z
  .union([z.literal("on"), z.literal("1"), z.literal("0"), z.literal("")])
  .transform((v) => (v === "on" || v === "1" ? true : v === "0" ? false : null))
  .nullable()
  .optional();

export function normalizeAddress(addressLine: string, parish?: string | null): string {
  return normalizeText(`${addressLine} ${parish ?? ""}`);
}

export const propertyInputSchema = z
  .object({
    propertyType: z.enum(PROPERTY_TYPES).default("apartamento"),
    status: z.enum(PROPERTY_STATUSES).default("prospect"),
    name: optionalText,
    addressLine: z.string().trim().min(3, "Indica a morada."),
    postalCode: optionalText.transform((v, ctx) => {
      if (v && !/^\d{4}-\d{3}$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "Formato 0000-000." });
        return z.NEVER;
      }
      return v;
    }),
    parish: optionalText,
    municipality: optionalText,
    district: optionalText,
    typology: optionalText,
    grossArea: optionalDecimal,
    netArea: optionalDecimal,
    floor: optionalText,
    floorsCount: optionalInt,
    hasElevator: tri,
    hasGarage: tri,
    parkingSpaces: optionalInt,
    hasBalcony: tri,
    hasTerrace: tri,
    hasYard: tri,
    bedrooms: optionalInt,
    bathrooms: optionalInt,
    condition: z
      .enum(PROPERTY_CONDITIONS)
      .or(z.literal(""))
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    constructionYear: optionalInt.transform((v, ctx) => {
      if (v !== null && v !== undefined && (v < 1800 || v > 2100)) {
        ctx.addIssue({ code: "custom", message: "Ano inválido." });
        return z.NEVER;
      }
      return v;
    }),
    energyClass: optionalText,
    vpt: optionalDecimal,
    isAru: z
      .union([z.literal("on"), z.literal("")])
      .optional()
      .transform((v) => v === "on"),
    matrixArticle: optionalText,
    fraction: optionalText,
    landRegistryDescription: optionalText,
    landRegistryOffice: optionalText,
    notes: optionalText,
  });

export type PropertyInput = z.input<typeof propertyInputSchema>;
export type PropertyData = z.output<typeof propertyInputSchema>;

const TRI_FIELDS = ["hasElevator", "hasGarage", "hasBalcony", "hasTerrace", "hasYard"] as const;

/** Converte FormData no objeto de entrada (strings). */
export function propertyInputFromForm(formData: FormData): PropertyInput {
  const s = (k: string) => String(formData.get(k) ?? "");
  const input: Record<string, string> = {};
  for (const key of [
    "propertyType", "status", "name", "addressLine", "postalCode", "parish", "municipality",
    "district", "typology", "grossArea", "netArea", "floor", "floorsCount", "parkingSpaces",
    "bedrooms", "bathrooms", "condition", "constructionYear", "energyClass", "vpt",
    "matrixArticle", "fraction", "landRegistryDescription", "landRegistryOffice", "notes",
  ]) {
    input[key] = s(key);
  }
  // Tri-state: o formulário envia "1" (sim), "0" (não) ou "" (desconhecido).
  for (const key of TRI_FIELDS) input[key] = s(key);
  input.isAru = formData.get("isAru") ? "on" : "";
  return input as unknown as PropertyInput;
}
