import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";

export const contactKind = pgEnum("contact_kind", ["person", "company"]);

export const contactRole = pgEnum("contact_role", [
  "consultor",
  "proprietario",
  "fornecedor",
  "banco",
  "advogado",
  "arquiteto",
  "outro",
]);

export type ContactRole = (typeof contactRole.enumValues)[number];

/**
 * Pessoas e empresas com quem a LOOP trabalha. Um contacto pode ter vários
 * papéis (consultor e proprietário, por exemplo). Fornecedores têm NIF.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    kind: contactKind("kind").notNull().default("person"),
    name: text("name").notNull(),
    roles: contactRole("roles").array().notNull().default([]),
    companyName: text("company_name"),
    phone: text("phone"),
    /** E.164 (+351…), calculado no código ao guardar. Serve para detetar duplicados. */
    phoneNormalized: text("phone_normalized"),
    email: text("email"),
    nif: text("nif"),
    address: text("address"),
    iban: text("iban"),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("contacts_org_phone_idx").on(t.organizationId, t.phoneNormalized),
    index("contacts_org_nif_idx").on(t.organizationId, t.nif),
    index("contacts_org_name_idx").on(t.organizationId, t.name),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
