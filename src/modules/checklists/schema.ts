import { boolean, date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "@/core/db/schema/core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";
import { properties } from "@/modules/properties/schema";

export const checklistEntity = pgEnum("checklist_entity", ["deal", "project", "sale"]);
export const checklistItemKind = pgEnum("checklist_item_kind", ["auto", "manual"]);
export const checklistItemStatus = pgEnum("checklist_item_status", ["pending", "done", "not_applicable"]);
export const checklistItemSource = pgEnum("checklist_item_source", ["auto", "manual", "context"]);

/**
 * Procedimento (template) por processo e versão: "Novo Negócio" v1, "Nova Obra" v1.
 * Os textos, a ordem, a obrigatoriedade e os bloqueios são dados; as regras
 * automáticas são código (`rules.ts`) referenciado por `rule_key`.
 */
export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    entityType: checklistEntity("entity_type").notNull(),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    trigger: text("trigger").notNull().default("on_create"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("checklist_templates_org_code_version_idx").on(t.organizationId, t.code, t.version)],
);

export const checklistTemplateItems = pgTable(
  "checklist_template_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => checklistTemplates.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    section: text("section").notNull(),
    label: text("label").notNull(),
    /** Como se conclui (uma frase). */
    help: text("help"),
    sort: integer("sort").notNull().default(0),
    kind: checklistItemKind("kind").notNull().default("manual"),
    /** Chave da regra em `rules.ts` (só itens automáticos). */
    ruleKey: text("rule_key"),
    isRequired: boolean("is_required").notNull().default(false),
    /** Condição de contexto: falsa → item "não aplicável" automaticamente. */
    appliesWhen: text("applies_when"),
    /** Código de outro item do template que tem de estar concluído antes (bloqueado). */
    dependsOnCode: text("depends_on_code"),
    /** "owner" (responsável do negócio) | "manager" (responsável da obra). */
    defaultAssignee: text("default_assignee"),
    /** Portas que este item condiciona: "hard:proposal:generate", "warn:deal:stage:proposta"… */
    gates: text("gates").array().notNull().default([]),
    /** Onde se resolve, relativo à ficha: "documentos?categoria=…", "business-plan". */
    linkPath: text("link_path"),
  },
  (t) => [uniqueIndex("checklist_template_items_template_code_idx").on(t.templateId, t.code)],
);

/** Instância: uma checklist por negócio/obra. Os contadores servem listas e Kanban. */
export const checklists = pgTable(
  "checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => checklistTemplates.id),
    templateVersion: integer("template_version").notNull(),
    entityType: checklistEntity("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    propertyId: uuid("property_id").references(() => properties.id),
    doneCount: integer("done_count").notNull().default(0),
    totalCount: integer("total_count").notNull().default(0),
    progress: numeric("progress", { precision: 5, scale: 4 }).notNull().default("0"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("checklists_entity_idx").on(t.entityType, t.entityId),
    index("checklists_org_idx").on(t.organizationId),
  ],
);

/**
 * Estado de cada passo na instância. `code/section/sort/kind/is_required` são
 * copiados do template para a instância não mudar se o template evoluir.
 */
export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => checklists.id, { onDelete: "cascade" }),
    templateItemId: uuid("template_item_id")
      .notNull()
      .references(() => checklistTemplateItems.id),
    code: text("code").notNull(),
    section: text("section").notNull(),
    sort: integer("sort").notNull().default(0),
    kind: checklistItemKind("kind").notNull(),
    isRequired: boolean("is_required").notNull().default(false),
    status: checklistItemStatus("status").notNull().default("pending"),
    source: checklistItemSource("source"),
    /** Texto curto da regra: "12 de 15", "último auto: 2026-08". */
    detail: text("detail"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => profiles.id),
    naNote: text("na_note"),
    assigneeUserId: uuid("assignee_user_id").references(() => profiles.id),
    dueDate: date("due_date"),
    priority: integer("priority"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("checklist_items_checklist_code_idx").on(t.checklistId, t.code),
    index("checklist_items_assignee_idx").on(t.assigneeUserId),
  ],
);

export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type ChecklistTemplateItem = typeof checklistTemplateItems.$inferSelect;
export type Checklist = typeof checklists.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type ChecklistEntityType = Checklist["entityType"];
export type ChecklistItemStatus = ChecklistItem["status"];
