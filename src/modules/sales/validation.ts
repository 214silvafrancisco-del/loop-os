import { z } from "zod";
import { optionalDate, optionalDecimal, optionalPercent, optionalText, optionalUrl, optionalUuid, stringsFromForm } from "@/core/lib/form-schemas";
import { leadSource, leadStatus } from "./schema";

export const SALE_FIELDS = [
  "ownerUserId",
  "listingPrice",
  "listingDate",
  "listingUrl",
  "cpcvDate",
  "cpcvDeposit",
  "deedDate",
  "salePrice",
  "buyerContactId",
  "otherSaleCosts",
  "actualHoldingCosts",
  "actualFinancingCosts",
  "notes",
] as const;

export const saleSchema = z.object({
  ownerUserId: optionalUuid,
  listingPrice: optionalDecimal,
  listingDate: optionalDate,
  listingUrl: optionalUrl,
  cpcvDate: optionalDate,
  cpcvDeposit: optionalDecimal,
  deedDate: optionalDate,
  salePrice: optionalDecimal,
  buyerContactId: optionalUuid,
  otherSaleCosts: optionalDecimal,
  actualHoldingCosts: optionalDecimal,
  actualFinancingCosts: optionalDecimal,
  notes: optionalText,
});
export type SaleInput = z.input<typeof saleSchema>;
export const saleInputFromForm = (fd: FormData) => stringsFromForm(fd, SALE_FIELDS);

export const AGENCY_FIELDS = ["contactId", "commissionPct", "commissionFixed", "commissionVatPct", "exclusive", "startDate", "endDate", "notes"] as const;

export const agencySchema = z.object({
  contactId: z.uuid("Escolhe a mediadora."),
  commissionPct: optionalPercent,
  commissionFixed: optionalDecimal,
  commissionVatPct: optionalPercent.transform((v) => v ?? "0.2300"),
  exclusive: z.string().transform((v) => v === "on" || v === "true" || v === "1"),
  startDate: optionalDate,
  endDate: optionalDate,
  notes: optionalText,
});
/** Valores tal como vêm do formulário (strings), para repor em caso de erro. */
export type AgencyInput = Record<(typeof AGENCY_FIELDS)[number], string>;
export const agencyInputFromForm = (fd: FormData) => stringsFromForm(fd, AGENCY_FIELDS);

export const LEAD_FIELDS = ["name", "phone", "email", "contactId", "source", "agencyId", "status", "visitDate", "offerAmount", "nextAction", "nextActionDate", "notes"] as const;

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Indica o nome do interessado.").max(200),
  phone: optionalText,
  email: optionalText,
  contactId: optionalUuid,
  source: z.enum(leadSource.enumValues),
  agencyId: optionalUuid,
  status: z.enum(leadStatus.enumValues),
  visitDate: optionalDate,
  offerAmount: optionalDecimal,
  nextAction: optionalText,
  nextActionDate: optionalDate,
  notes: optionalText,
});
export type LeadInput = Record<(typeof LEAD_FIELDS)[number], string>;
export const leadInputFromForm = (fd: FormData) => stringsFromForm(fd, LEAD_FIELDS);

export const nextActionSchema = z.object({ nextAction: optionalText, nextActionDate: optionalDate });
