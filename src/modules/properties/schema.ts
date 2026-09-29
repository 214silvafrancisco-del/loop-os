import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";

export const propertyType = pgEnum("property_type", [
  "apartamento",
  "predio",
  "moradia",
  "loja",
  "terreno",
  "outro",
]);

export const propertyStatus = pgEnum("property_status", [
  "prospect",
  "owned",
  "for_sale",
  "sold",
]);

export const propertyCondition = pgEnum("property_condition", [
  "para_obras",
  "habitavel",
  "remodelado",
  "novo",
]);

/**
 * O imóvel físico. Um registo único que atravessa negócio, obra e venda.
 * `ref` (LH-0001) é atribuída por trigger na inserção.
 */
export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    ref: text("ref").notNull().default(""),
    propertyType: propertyType("property_type").notNull().default("apartamento"),
    status: propertyStatus("status").notNull().default("prospect"),
    name: text("name"),

    // Localização
    addressLine: text("address_line").notNull(),
    /** minúsculas, sem acentos nem pontuação; para detetar duplicados. */
    addressNormalized: text("address_normalized").notNull().default(""),
    postalCode: text("postal_code"),
    parish: text("parish"),
    municipality: text("municipality"),
    district: text("district"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),

    // Características
    typology: text("typology"),
    grossArea: numeric("gross_area", { precision: 10, scale: 2 }),
    netArea: numeric("net_area", { precision: 10, scale: 2 }),
    floor: text("floor"),
    floorsCount: integer("floors_count"),
    hasElevator: boolean("has_elevator"),
    hasGarage: boolean("has_garage"),
    parkingSpaces: integer("parking_spaces"),
    hasBalcony: boolean("has_balcony"),
    hasTerrace: boolean("has_terrace"),
    hasYard: boolean("has_yard"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    condition: propertyCondition("condition"),
    constructionYear: integer("construction_year"),
    energyClass: text("energy_class"),

    // Fiscal / registral
    vpt: numeric("vpt", { precision: 14, scale: 2 }),
    isAru: boolean("is_aru").notNull().default(false),
    matrixArticle: text("matrix_article"),
    fraction: text("fraction"),
    landRegistryDescription: text("land_registry_description"),
    landRegistryOffice: text("land_registry_office"),

    notes: text("notes"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("properties_org_ref_idx").on(t.organizationId, t.ref),
    index("properties_org_status_idx").on(t.organizationId, t.status),
    index("properties_org_address_idx").on(t.organizationId, t.addressNormalized),
    index("properties_org_municipality_idx").on(t.organizationId, t.municipality),
  ],
);

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
