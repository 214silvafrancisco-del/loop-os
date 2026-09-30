import { sql } from "drizzle-orm";
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

export const supplierControlMode = pgEnum("supplier_control_mode", ["autos", "fatura"]);

/**
 * Fornecedores da obra (empreiteiro, carpinteiro, caixilheiro…). Vivem na
 * obra, não nos Contactos; `contact_id` liga opcionalmente a um contacto.
 * `control_mode`: "autos" = autos de medição mensais; "fatura" = as faturas
 * comparam-se diretamente com o orçamentado.
 */
export const projectSuppliers = pgTable(
  "project_suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind"),
    nif: text("nif"),
    phone: text("phone"),
    email: text("email"),
    controlMode: supplierControlMode("control_mode").notNull().default("autos"),
    contactId: uuid("contact_id").references(() => contacts.id),
    sort: integer("sort").notNull().default(0),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [uniqueIndex("project_suppliers_project_name_idx").on(t.projectId, t.name), index("project_suppliers_project_sort_idx").on(t.projectId, t.sort)],
);

/**
 * Orçamento em árvore (capítulo → subcapítulo → artigo), como o mapa de
 * quantidades. Só as folhas têm quantidade × preço; os pais somam os filhos.
 * O fornecedor define-se no capítulo e é copiado para todas as linhas dele.
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
    projectSupplierId: uuid("project_supplier_id").references(() => projectSuppliers.id),
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
  (t) => [index("budget_lines_project_parent_sort_idx").on(t.projectId, t.parentId, t.sort), index("budget_lines_supplier_idx").on(t.projectSupplierId)],
);

export const measurementStatus = pgEnum("measurement_status", ["draft", "closed"]);
/** "trabalho" = trabalho executado no período; "adiantamento" = fatura de adiantamento, define a % a descontar nos autos de trabalho seguintes. */
export const measurementKind = pgEnum("measurement_kind", ["trabalho", "adiantamento"]);

/**
 * Auto de medição mensal de um fornecedor: % acumulada por artigo desse
 * fornecedor. Fechado é imutável (trigger na BD); correções vão no auto seguinte.
 */
export const measurementReports = pgTable(
  "measurement_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    projectSupplierId: uuid("project_supplier_id")
      .notNull()
      .references(() => projectSuppliers.id),
    number: integer("number").notNull(),
    kind: measurementKind("kind").notNull().default("trabalho"),
    /** Só nos autos de adiantamento: fração (0.33 = 33 %). */
    advancePct: numeric("advance_pct", { precision: 7, scale: 4 }),
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
    uniqueIndex("measurement_reports_supplier_month_idx")
      .on(t.projectSupplierId, t.periodMonth)
      .where(sql`${t.kind} = 'trabalho'`),
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

export const paymentMethod = pgEnum("payment_method", ["transferencia", "mb", "cartao", "numerario", "outro"]);

/** Fatura de um fornecedor da obra. Compara-se com o auto (opcional) e, em soma, com o orçamentado dele. */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    projectSupplierId: uuid("project_supplier_id")
      .notNull()
      .references(() => projectSuppliers.id),
    number: text("number").notNull(),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    description: text("description"),
    netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull(),
    vatRate: numeric("vat_rate", { precision: 7, scale: 4 }).notNull().default("0.2300"),
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    measurementReportId: uuid("measurement_report_id").references(() => measurementReports.id, { onDelete: "set null" }),
    documentId: uuid("document_id"),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("invoices_project_date_idx").on(t.projectId, t.issueDate),
    index("invoices_org_due_idx").on(t.organizationId, t.dueDate),
    index("invoices_supplier_idx").on(t.projectSupplierId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    paidOn: date("paid_on").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    method: paymentMethod("method").notNull().default("transferencia"),
    reference: text("reference"),
    documentId: uuid("document_id"),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
);

export type Project = typeof projects.$inferSelect;
export type ProjectSupplier = typeof projectSuppliers.$inferSelect;
export type BudgetLine = typeof budgetLines.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type MeasurementReport = typeof measurementReports.$inferSelect;
export type MeasurementLine = typeof measurementLines.$inferSelect;
