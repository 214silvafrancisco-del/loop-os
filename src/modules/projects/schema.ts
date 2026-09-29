import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "@/core/db/schema/core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";
import { deals } from "@/modules/deals/schema";
import { properties } from "@/modules/properties/schema";

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

export type Project = typeof projects.$inferSelect;
