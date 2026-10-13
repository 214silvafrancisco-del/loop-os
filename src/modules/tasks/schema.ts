import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "@/core/db/schema/core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";
import { properties } from "@/modules/properties/schema";

export const taskStatus = pgEnum("task_status", ["por_iniciar", "em_curso", "concluida", "bloqueada"]);
export type TaskStatus = (typeof taskStatus.enumValues)[number];

/** Registo a que a tarefa pertence. */
export const taskEntity = pgEnum("task_entity", ["deal", "project", "sale", "sale_lead"]);
export type TaskEntity = (typeof taskEntity.enumValues)[number];

/**
 * Tarefas (Fase 2): a «próxima tarefa» de um negócio, obra, venda ou lead é a
 * tarefa aberta com data-limite mais próxima. Concluir não apaga: o histórico
 * fica na tabela; as alterações ficam na auditoria (quem e quando).
 * Substitui o campo único `next_action` (mantido como legado até validação).
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    entityType: taskEntity("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    /** Imóvel do registo, para a auditoria e para a ficha do imóvel. */
    propertyId: uuid("property_id").references(() => properties.id),
    title: text("title").notNull(),
    notes: text("notes"),
    /** Responsável pela execução (distinto do responsável global do registo). */
    assigneeUserId: uuid("assignee_user_id").references(() => profiles.id),
    dueDate: date("due_date"),
    status: taskStatus("status").notNull().default("por_iniciar"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => profiles.id),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [
    index("tasks_entity_idx").on(t.entityType, t.entityId),
    index("tasks_org_status_due_idx").on(t.organizationId, t.status, t.dueDate),
    index("tasks_assignee_status_idx").on(t.assigneeUserId, t.status),
  ],
);

export type Task = typeof tasks.$inferSelect;
