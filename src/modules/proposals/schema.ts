import { boolean, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";
import { deals } from "@/modules/deals/schema";

export const proposalStatus = pgEnum("proposal_status", ["draft", "generated", "sent", "accepted", "rejected"]);

/** Templates registados em código (`templates/index.ts`); a BD guarda nome, textos e estado. */
export const proposalTemplates = pgTable(
  "proposal_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    layoutKey: text("layout_key").notNull(),
    /** Textos por defeito: condições, validade, prazo, assinatura. */
    pdfDefaults: jsonb("pdf_defaults").$type<ProposalDefaults>().notNull().default({}),
    whatsappTemplate: text("whatsapp_template"),
    isActive: boolean("is_active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("proposal_templates_org_code_idx").on(t.organizationId, t.code)],
);

export type ProposalDefaults = {
  conditions?: string;
  deadlineDays?: number;
  validityDays?: number;
  signature?: string;
};

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => proposalTemplates.id),
    number: text("number").notNull(),
    versionNo: integer("version_no").notNull().default(1),
    status: proposalStatus("status").notNull().default("generated"),
    offerPrice: numeric("offer_price", { precision: 14, scale: 2 }).notNull(),
    deadlineDays: integer("deadline_days"),
    validityDays: integer("validity_days"),
    conditions: text("conditions"),
    observations: text("observations"),
    /** Tudo o que foi impresso, para reproduzir o PDF mesmo que o negócio mude. */
    dataSnapshot: jsonb("data_snapshot").notNull(),
    whatsappText: text("whatsapp_text"),
    documentId: uuid("document_id"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("proposals_number_version_idx").on(t.organizationId, t.number, t.versionNo),
    index("proposals_deal_idx").on(t.dealId, t.createdAt),
  ],
);

export type Proposal = typeof proposals.$inferSelect;
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
