import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "@/core/db/schema/core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";
import { contacts } from "@/modules/contacts/schema";
import { properties } from "@/modules/properties/schema";
import { dealStages, sourceChannels, tags } from "@/modules/settings/schema";

export const dealStatus = pgEnum("deal_status", ["active", "excluded"]);

/**
 * Oportunidade de aquisição sobre um imóvel. A referência é a do imóvel;
 * `seq` distingue vários negócios no mesmo imóvel ao longo do tempo.
 */
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    seq: integer("seq").notNull().default(1),
    name: text("name"),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => dealStages.id),
    status: dealStatus("status").notNull().default("active"),
    excludedAt: timestamp("excluded_at", { withTimezone: true }),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id),
    enteredAt: date("entered_at").notNull().defaultNow(),

    // Origem
    sourceChannelId: uuid("source_channel_id").references(() => sourceChannels.id),
    sourceContactId: uuid("source_contact_id").references(() => contacts.id),
    listingUrl: text("listing_url"),
    sourceCommissionPct: numeric("source_commission_pct", { precision: 7, scale: 4 }),
    sourceNotes: text("source_notes"),

    // Follow-up
    nextAction: text("next_action"),
    nextActionDate: date("next_action_date"),

    // Financeiro inicial
    askingPrice: numeric("asking_price", { precision: 14, scale: 2 }),
    targetPrice: numeric("target_price", { precision: 14, scale: 2 }),
    maxPrice: numeric("max_price", { precision: 14, scale: 2 }),
    estimatedWorks: numeric("estimated_works", { precision: 14, scale: 2 }),
    estimatedSalePrice: numeric("estimated_sale_price", { precision: 14, scale: 2 }),

    // Compra
    finalPrice: numeric("final_price", { precision: 14, scale: 2 }),
    cpcvDate: date("cpcv_date"),
    deedDate: date("deed_date"),
    actualAcquisitionCosts: numeric("actual_acquisition_costs", { precision: 14, scale: 2 }),
    imtResaleDeadline: date("imt_resale_deadline"),

    // Cache do cenário ativo do Business Plan (escrito pelo motor, Step 09)
    activeScenarioId: uuid("active_scenario_id"),
    bpProfitNet: numeric("bp_profit_net", { precision: 14, scale: 2 }),
    bpMargin: numeric("bp_margin", { precision: 9, scale: 6 }),
    bpRoi: numeric("bp_roi", { precision: 9, scale: 6 }),
    bpRoe: numeric("bp_roe", { precision: 9, scale: 6 }),
    bpAnnualized: numeric("bp_annualized", { precision: 9, scale: 6 }),
    bpEquity: numeric("bp_equity", { precision: 14, scale: 2 }),

    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("deals_property_seq_idx").on(t.propertyId, t.seq),
    index("deals_org_status_stage_idx").on(t.organizationId, t.status, t.stageId),
    index("deals_org_next_action_idx").on(t.organizationId, t.nextActionDate),
    index("deals_owner_idx").on(t.ownerUserId),
  ],
);

export const dealTags = pgTable(
  "deal_tags",
  {
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.tagId] })],
);

/** Notas livres do negócio (a próxima ação vive no cabeçalho, não aqui). */
export const dealNotes = pgTable(
  "deal_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [index("deal_notes_deal_created_idx").on(t.dealId, t.createdAt)],
);

export type Deal = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
export type DealNote = typeof dealNotes.$inferSelect;
