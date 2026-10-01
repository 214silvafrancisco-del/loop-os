import { boolean, date, index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "@/core/db/schema/core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";
import { contacts } from "@/modules/contacts/schema";
import { deals } from "@/modules/deals/schema";
import { projects } from "@/modules/projects/schema";
import { properties } from "@/modules/properties/schema";

/** Fases da venda: Preparação → À venda → CPCV → Vendido (ou Cancelada). */
export const saleStage = pgEnum("sale_stage", ["preparacao", "a_venda", "cpcv", "vendido", "cancelada"]);
export type SaleStage = (typeof saleStage.enumValues)[number];

export const leadStatus = pgEnum("lead_status", ["novo", "visita_marcada", "visitou", "proposta", "ganho", "perdido"]);
export type LeadStatus = (typeof leadStatus.enumValues)[number];

export const leadSource = pgEnum("lead_source", ["mediadora", "portal", "direto", "outro"]);
export type LeadSource = (typeof leadSource.enumValues)[number];

/**
 * Venda de um imóvel comprado (Step 26). Uma venda ativa por imóvel; nasce do
 * negócio em Compra ou da obra concluída e fecha o ciclo com o P&L real.
 * Os documentos continuam no imóvel (reutilizados aqui).
 */
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    dealId: uuid("deal_id").references(() => deals.id),
    projectId: uuid("project_id").references(() => projects.id),
    stage: saleStage("stage").notNull().default("preparacao"),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id),

    // Anúncio
    listingPrice: numeric("listing_price", { precision: 14, scale: 2 }),
    listingDate: date("listing_date"),
    listingUrl: text("listing_url"),

    // Fecho
    cpcvDate: date("cpcv_date"),
    cpcvDeposit: numeric("cpcv_deposit", { precision: 14, scale: 2 }),
    deedDate: date("deed_date"),
    salePrice: numeric("sale_price", { precision: 14, scale: 2 }),
    buyerContactId: uuid("buyer_contact_id").references(() => contacts.id),

    // Custos reais (totais manuais; o detalhe pode vir mais tarde)
    otherSaleCosts: numeric("other_sale_costs", { precision: 14, scale: 2 }).notNull().default("0"),
    actualHoldingCosts: numeric("actual_holding_costs", { precision: 14, scale: 2 }),
    actualFinancingCosts: numeric("actual_financing_costs", { precision: 14, scale: 2 }),

    // Follow-up
    nextAction: text("next_action"),
    nextActionDate: date("next_action_date"),
    notes: text("notes"),

    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("sales_org_stage_idx").on(t.organizationId, t.stage),
    index("sales_org_next_action_idx").on(t.organizationId, t.nextActionDate),
    index("sales_property_idx").on(t.propertyId),
    index("sales_deal_idx").on(t.dealId),
  ],
);

/** Mediadoras a vender o imóvel: várias em simultâneo, cada uma com a sua comissão. */
export const saleAgencies = pgTable(
  "sale_agencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    /** Denormalizado para a auditoria e para filtrar por imóvel. */
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    commissionPct: numeric("commission_pct", { precision: 7, scale: 4 }),
    commissionFixed: numeric("commission_fixed", { precision: 14, scale: 2 }),
    commissionVatPct: numeric("commission_vat_pct", { precision: 7, scale: 4 }).notNull().default("0.2300"),
    exclusive: boolean("exclusive").notNull().default(false),
    startDate: date("start_date"),
    endDate: date("end_date"),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [uniqueIndex("sale_agencies_sale_contact_idx").on(t.saleId, t.contactId)],
);

/** Interessados (leads de compra) com estado, visita, proposta e próxima ação. */
export const saleLeads = pgTable(
  "sale_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    contactId: uuid("contact_id").references(() => contacts.id),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    source: leadSource("source").notNull().default("portal"),
    agencyId: uuid("agency_id").references(() => saleAgencies.id, { onDelete: "set null" }),
    status: leadStatus("status").notNull().default("novo"),
    visitDate: date("visit_date"),
    offerAmount: numeric("offer_amount", { precision: 14, scale: 2 }),
    nextAction: text("next_action"),
    nextActionDate: date("next_action_date"),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [index("sale_leads_sale_status_idx").on(t.saleId, t.status), index("sale_leads_org_next_action_idx").on(t.organizationId, t.nextActionDate)],
);

export type Sale = typeof sales.$inferSelect;
export type SaleAgency = typeof saleAgencies.$inferSelect;
export type SaleLead = typeof saleLeads.$inferSelect;
