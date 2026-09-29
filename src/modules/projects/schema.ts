import { date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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

export const measurementStatus = pgEnum("measurement_status", ["draft", "closed"]);

/**
 * Auto de medição mensal: % acumulada por artigo. Fechado é imutável
 * (trigger na BD); correções vão no auto seguinte.
 */
export const measurementReports = pgTable(
  "measurement_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    periodMonth: date("period_month").notNull(),
    reportDate: date("report_date").notNull(),
    status: measurementStatus("status").notNull().default("draft"),
    notes: text("notes"),
    documentId: uuid("document_id"),
    /** Snapshots no fecho. */
    totalPeriod: numeric("total_period", { precision: 14, scale: 2 }).notNull().default("0"),
    totalCumulative: numeric("total_cumulative", { precision: 14, scale: 2 }).notNull().default("0"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("measurement_reports_project_number_idx").on(t.projectId, t.number),
    uniqueIndex("measurement_reports_project_month_idx").on(t.projectId, t.periodMonth),
  ],
);

export const measurementLines = pgTable(
  "measurement_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => measurementReports.id, { onDelete: "cascade" }),
    budgetLineId: uuid("budget_line_id")
      .notNull()
      .references(() => budgetLines.id, { onDelete: "cascade" }),
    /** 0–1 */
    pctCumulative: numeric("pct_cumulative", { precision: 6, scale: 4 }).notNull().default("0"),
    amountCumulative: numeric("amount_cumulative", { precision: 14, scale: 2 }).notNull().default("0"),
    amountPeriod: numeric("amount_period", { precision: 14, scale: 2 }).notNull().default("0"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [uniqueIndex("measurement_lines_report_line_idx").on(t.reportId, t.budgetLineId)],
);

export type Project = typeof projects.$inferSelect;
export type BudgetLine = typeof budgetLines.$inferSelect;
export type MeasurementReport = typeof measurementReports.$inferSelect;
export type MeasurementLine = typeof measurementLines.$inferSelect;
