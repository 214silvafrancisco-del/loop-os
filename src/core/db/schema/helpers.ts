import { timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./core";

/** created_at / updated_at presentes em todas as tabelas. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

/** organization_id obrigatório em todas as tabelas de domínio. */
export const organizationRef = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id);
