import { bigserial, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditAction = pgEnum("audit_action", ["insert", "update", "delete"]);

/**
 * Registo de alterações, escrito por um trigger genérico (ver migração 0005).
 * `property_id` é resolvido pelo trigger para o Histórico do negócio/imóvel.
 * O utilizador vem das colunas created_by/updated_by da linha alterada.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id"),
    tableName: text("table_name").notNull(),
    rowId: uuid("row_id").notNull(),
    propertyId: uuid("property_id"),
    action: auditAction("action").notNull(),
    changedFields: text("changed_fields").array(),
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    userId: uuid("user_id"),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_table_row_idx").on(t.tableName, t.rowId),
    index("audit_log_property_at_idx").on(t.propertyId, t.at),
    index("audit_log_org_at_idx").on(t.organizationId, t.at),
  ],
);

export type AuditEntry = typeof auditLog.$inferSelect;
