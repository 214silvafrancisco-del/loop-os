import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { userRole } from "./enums";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export type OrganizationSettings = {
  proposalSignature?: string;
  proposalDefaultConditions?: string;
  defaultVatPct?: number;
  comparableAreaAdjPctPerM2?: number;
  /** Antigo alvo de ROE (mantido para compatibilidade). */
  targetRoePct?: number;
  /** Retorno anualizado mínimo para validar um negócio e calcular o preço máximo (LOOP: 30 %). */
  targetAnnualizedPct?: number;
};

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nif: text("nif"),
  address: text("address"),
  nextPropertySeq: integer("next_property_seq").notNull().default(1),
  nextProposalSeq: integer("next_proposal_seq").notNull().default(1),
  settings: jsonb("settings").$type<OrganizationSettings>().notNull().default({}),
  ...timestamps,
});

/**
 * Perfil de utilizador. `id` é o mesmo uuid de `auth.users` (Supabase Auth).
 * A ligação (FK + trigger que cria o perfil no registo) entra no Step 03.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    role: userRole("role").notNull().default("user"),
    isActive: boolean("is_active").notNull().default(true),
    avatarUrl: text("avatar_url"),
    ...timestamps,
  },
  (t) => [uniqueIndex("profiles_email_idx").on(t.email)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    role: userRole("role").notNull(),
    module: text("module").notNull(),
    canView: boolean("can_view").notNull().default(true),
    canCreate: boolean("can_create").notNull().default(false),
    canEdit: boolean("can_edit").notNull().default(false),
    canDelete: boolean("can_delete").notNull().default(false),
    canExport: boolean("can_export").notNull().default(false),
  },
  (t) => [
    uniqueIndex("role_permissions_org_role_module_idx").on(
      t.organizationId,
      t.role,
      t.module,
    ),
  ],
);
