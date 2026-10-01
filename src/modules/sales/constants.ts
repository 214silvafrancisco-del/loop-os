import type { LeadSource, LeadStatus, SaleStage } from "./schema";

/** Fases da venda, por ordem, com a cor usada nos badges e no Kanban. */
export const SALE_STAGES: { value: SaleStage; label: string; color: string; closed?: boolean }[] = [
  { value: "preparacao", label: "Preparação", color: "#64748b" },
  { value: "a_venda", label: "À venda", color: "#2563eb" },
  { value: "cpcv", label: "CPCV", color: "#f59e0b" },
  { value: "vendido", label: "Vendido", color: "#16a34a", closed: true },
  { value: "cancelada", label: "Cancelada", color: "#9ca3af", closed: true },
];

export const SALE_STAGE_LABEL = Object.fromEntries(SALE_STAGES.map((s) => [s.value, s.label])) as Record<SaleStage, string>;
export const SALE_STAGE_COLOR = Object.fromEntries(SALE_STAGES.map((s) => [s.value, s.color])) as Record<SaleStage, string>;

export const LEAD_STATUSES: { value: LeadStatus; label: string; closed?: boolean }[] = [
  { value: "novo", label: "Novo" },
  { value: "visita_marcada", label: "Visita marcada" },
  { value: "visitou", label: "Visitou" },
  { value: "proposta", label: "Proposta" },
  { value: "ganho", label: "Ganho", closed: true },
  { value: "perdido", label: "Perdido", closed: true },
];
export const LEAD_STATUS_LABEL = Object.fromEntries(LEAD_STATUSES.map((s) => [s.value, s.label])) as Record<LeadStatus, string>;

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: "mediadora", label: "Mediadora" },
  { value: "portal", label: "Portal (Idealista, Imovirtual…)" },
  { value: "direto", label: "Direto" },
  { value: "outro", label: "Outro" },
];
export const LEAD_SOURCE_LABEL = Object.fromEntries(LEAD_SOURCES.map((s) => [s.value, s.label])) as Record<LeadSource, string>;

/** Estado do imóvel que cada fase da venda implica. */
export function propertyStatusForStage(stage: SaleStage): "owned" | "for_sale" | "sold" {
  switch (stage) {
    case "a_venda":
    case "cpcv":
      return "for_sale";
    case "vendido":
      return "sold";
    default:
      return "owned";
  }
}

/** O negócio de origem sai do Kanban quando a venda fecha. */
export function dealStatusForStage(stage: SaleStage): "active" | "sold" {
  return stage === "vendido" ? "sold" : "active";
}

/** Comissão de uma mediadora sobre um preço: % ou valor fixo, com IVA. */
export function commissionAmount(
  price: number | null,
  agency: { commissionPct: number | null; commissionFixed: number | null; commissionVatPct: number },
): { net: number; vat: number; total: number } {
  const net = agency.commissionFixed !== null ? agency.commissionFixed : price !== null && agency.commissionPct !== null ? price * agency.commissionPct : 0;
  const vat = net * agency.commissionVatPct;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { net: r2(net), vat: r2(vat), total: r2(net + vat) };
}

/** Dias desde o anúncio (até à escritura, se já houver). */
export function daysOnMarket(listingDate: string | null, deedDate: string | null, today: string): number | null {
  if (!listingDate) return null;
  const end = deedDate ?? today;
  const ms = new Date(end + "T00:00:00Z").getTime() - new Date(listingDate + "T00:00:00Z").getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}
