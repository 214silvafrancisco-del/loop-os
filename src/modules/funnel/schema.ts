import { date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";

/**
 * Funil comercial semanal (Step 27): volumes reais por fase, uma linha por
 * semana (segunda a domingo). Valores nulos = ainda não preenchidos; 0 = zero.
 * As taxas de conversão e a previsão de compras são derivadas (forecast.ts),
 * nunca guardadas.
 */
export const funnelWeeks = pgTable(
  "funnel_weeks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    /** Segunda-feira da semana (YYYY-MM-DD). */
    weekStart: date("week_start").notNull(),
    leads: integer("leads"),
    visits: integer("visits"),
    proposals: integer("proposals"),
    purchases: integer("purchases"),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [uniqueIndex("funnel_weeks_org_week_idx").on(t.organizationId, t.weekStart)],
);

export type FunnelWeekRow = typeof funnelWeeks.$inferSelect;
