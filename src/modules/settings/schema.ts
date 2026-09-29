import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { documentEntity, imtRegime } from "@/core/db/schema/enums";
import { organizationRef } from "@/core/db/schema/helpers";

// Listas configuráveis em Definições. Todas têm organização, nome, ordem e ativo.

const listColumns = {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: organizationRef(),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

/** Fases do pipeline: Lead Fria → Lead Morna → Visita → Proposta → Compra. */
export const dealStages = pgTable(
  "deal_stages",
  {
    ...listColumns,
    color: text("color"),
    /** Só uma fase por organização marca a compra (desbloqueia "Criar Obra"). */
    isPurchase: boolean("is_purchase").notNull().default(false),
    /** Fase atribuída a negócios novos. */
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [
    uniqueIndex("deal_stages_org_name_idx").on(t.organizationId, t.name),
    uniqueIndex("deal_stages_org_purchase_idx")
      .on(t.organizationId)
      .where(sql`${t.isPurchase} = true`),
  ],
);

/** Origem do negócio: Sites, Consultor, Proprietário, Placa de rua, Investidor. */
export const sourceChannels = pgTable(
  "source_channels",
  { ...listColumns },
  (t) => [
    uniqueIndex("source_channels_org_name_idx").on(t.organizationId, t.name),
  ],
);

/** Capítulos do orçamento de obra. */
export const budgetCategories = pgTable(
  "budget_categories",
  {
    ...listColumns,
    code: text("code"),
  },
  (t) => [
    uniqueIndex("budget_categories_org_name_idx").on(t.organizationId, t.name),
  ],
);

/** Categorias documentais, agrupadas em imovel / juridico / financeiro / tecnico / comercial. */
export const documentCategories = pgTable(
  "document_categories",
  {
    ...listColumns,
    group: text("group").notNull(),
    defaultEntity: documentEntity("default_entity"),
  },
  (t) => [
    uniqueIndex("document_categories_org_group_name_idx").on(
      t.organizationId,
      t.group,
      t.name,
    ),
  ],
);

export const tags = pgTable(
  "tags",
  {
    ...listColumns,
    color: text("color"),
  },
  (t) => [uniqueIndex("tags_org_name_idx").on(t.organizationId, t.name)],
);

/**
 * Escalões de IMT por ano e regime (hpp = habitação própria e permanente,
 * hs = habitação secundária). IMT = base × rate − deduction.
 */
export const imtBrackets = pgTable(
  "imt_brackets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    year: integer("year").notNull(),
    regime: imtRegime("regime").notNull(),
    lower: numeric("lower", { precision: 14, scale: 2 }).notNull(),
    upper: numeric("upper", { precision: 14, scale: 2 }),
    rate: numeric("rate", { precision: 7, scale: 4 }).notNull(),
    deduction: numeric("deduction", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
  },
  (t) => [
    uniqueIndex("imt_brackets_org_year_regime_lower_idx").on(
      t.organizationId,
      t.year,
      t.regime,
      t.lower,
    ),
  ],
);
