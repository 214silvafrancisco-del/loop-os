import { date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "@/core/db/schema/core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";
import { contacts } from "@/modules/contacts/schema";
import { deals } from "@/modules/deals/schema";
import { properties } from "@/modules/properties/schema";
import { budgetCategories } from "@/modules/settings/schema";

export const projectStatus = pgEnum("project_status", [
  "planeamento",
  "a_iniciar",
  "em_curso",
  "pausada",
  "concluida",
  "cancelada",
]);

/** Obra de remodelação de um imóvel comprado. Criada a partir do negócio. */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id),
    name: text("name").notNull(),
    status: projectStatus("status").notNull().default("planeamento"),
    managerUserId: uuid("manager_user_id").references(() => profiles.id),
    plannedStart: date("planned_start"),
    actualStart: date("actual_start"),
    plannedEnd: date("planned_end"),
    actualEnd: date("actual_end"),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("projects_org_status_idx").on(t.organizationId, t.status),
    index("projects_property_idx").on(t.propertyId),
    index("projects_deal_idx").on(t.dealId),
  ],
);

/**
 * Orçamento em árvore (capítulo → subcapítulo → artigo), como o mapa de
 * quantidades. Só as folhas têm quantidade × preço; os pais somam os filhos.
 */
export const budgetLines = pgTable(
  "budget_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    depth: integer("depth").notNull().default(0),
    code: text("code"),
    sort: integer("sort").notNull().default(0),
    categoryId: uuid("category_id").references(() => budgetCategories.id),
    description: text("description").notNull(),
    supplierId: uuid("supplier_id").references(() => contacts.id),
    quantity: numeric("quantity", { precision: 12, scale: 3 }),
    unit: text("unit"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 4 }),
    /** Folhas: quantidade × preço unitário (sem IVA). Pais: soma dos filhos, calculada em código. */
    budgeted: numeric("budgeted", { precision: 14, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 7, scale: 4 }).notNull().default("0.2300"),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [index("budget_lines_project_parent_sort_idx").on(t.projectId, t.parentId, t.sort)],
);

export type Project = typeof projects.$inferSelect;
export type BudgetLine = typeof budgetLines.$inferSelect;
