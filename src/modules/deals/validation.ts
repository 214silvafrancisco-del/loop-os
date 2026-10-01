import { z } from "zod";
import {
  optionalDate,
  optionalDecimal,
  optionalPercent,
  optionalText,
  optionalUrl,
  optionalUuid,
  stringsFromForm,
} from "@/core/lib/form-schemas";
import { PROPERTY_TYPES } from "@/modules/properties/validation";

export const DEAL_STATUS_LABEL = { active: "Ativo", excluded: "Excluído", sold: "Vendido" } as const;

/** Campos do negócio (comuns a criação e edição). */
const dealFields = {
  name: optionalText,
  stageId: z.uuid("Escolhe a fase."),
  ownerUserId: optionalUuid,
  enteredAt: optionalDate,
  sourceChannelId: optionalUuid,
  sourceContactId: optionalUuid,
  listingUrl: optionalUrl,
  sourceCommissionPct: optionalPercent,
  sourceNotes: optionalText,
  nextAction: optionalText,
  nextActionDate: optionalDate,
  askingPrice: optionalDecimal,
  targetPrice: optionalDecimal,
  maxPrice: optionalDecimal,
  estimatedWorks: optionalDecimal,
  estimatedSalePrice: optionalDecimal,
  finalPrice: optionalDecimal,
  cpcvDate: optionalDate,
  deedDate: optionalDate,
  actualAcquisitionCosts: optionalDecimal,
};

/** Dados mínimos do imóvel ao criar um negócio (o resto edita-se na ficha do imóvel). */
const propertyFields = {
  existingPropertyId: optionalUuid,
  propertyType: z.enum(PROPERTY_TYPES).default("apartamento"),
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
  typology: optionalText,
  floor: optionalText,
  grossArea: optionalDecimal,
};

/** Contacto novo criado inline a partir do formulário do negócio. */
const newContactFields = {
  newContactName: optionalText,
  newContactPhone: optionalText,
  newContactCompany: optionalText,
};

export const dealCreateSchema = z.object({ ...propertyFields, ...dealFields, ...newContactFields });
export const dealUpdateSchema = z.object(dealFields);

export type DealCreateInput = z.input<typeof dealCreateSchema>;
export type DealCreateData = z.output<typeof dealCreateSchema>;
export type DealUpdateInput = z.input<typeof dealUpdateSchema>;
export type DealUpdateData = z.output<typeof dealUpdateSchema>;

export const DEAL_UPDATE_KEYS = Object.keys(dealFields) as (keyof typeof dealFields)[];
export const DEAL_CREATE_KEYS = [
  ...Object.keys(propertyFields),
  ...DEAL_UPDATE_KEYS,
  ...Object.keys(newContactFields),
] as (keyof DealCreateInput)[];

export function dealCreateInputFromForm(formData: FormData): DealCreateInput {
  return stringsFromForm(formData, DEAL_CREATE_KEYS) as unknown as DealCreateInput;
}

export function dealUpdateInputFromForm(formData: FormData): DealUpdateInput {
  return stringsFromForm(formData, DEAL_UPDATE_KEYS) as unknown as DealUpdateInput;
}

/** Nome por defeito: "T2 Benfica" ou a morada. */
export function defaultDealName(p: { typology?: string | null; parish?: string | null; municipality?: string | null; addressLine: string }) {
  const place = p.parish ?? p.municipality;
  if (p.typology && place) return `${p.typology} ${place}`;
  return place ? `${p.addressLine}, ${place}` : p.addressLine;
}

/** Escritura + 3 anos: prazo para revender com isenção de IMT (art. 7.º CIMT). */
export function imtResaleDeadline(deedDate: string | null | undefined): string | null {
  if (!deedDate) return null;
  const d = new Date(deedDate);
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().slice(0, 10);
}
