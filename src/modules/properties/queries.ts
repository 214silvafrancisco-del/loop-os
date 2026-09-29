import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { properties, type Property } from "./schema";
import type { PROPERTY_STATUSES, PROPERTY_TYPES } from "./validation";

export type PropertyListFilters = {
  q?: string;
  status?: (typeof PROPERTY_STATUSES)[number];
  propertyType?: (typeof PROPERTY_TYPES)[number];
  municipality?: string;
  limit?: number;
};

export async function listProperties(
  organizationId: string,
  filters: PropertyListFilters = {},
): Promise<Property[]> {
  const conditions = [eq(properties.organizationId, organizationId), isNull(properties.deletedAt)];

  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(properties.ref, pattern),
        ilike(properties.name, pattern),
        ilike(properties.addressLine, pattern),
        ilike(properties.parish, pattern),
        ilike(properties.municipality, pattern),
        ilike(properties.postalCode, pattern),
      )!,
    );
  }
  if (filters.status) conditions.push(eq(properties.status, filters.status));
  if (filters.propertyType) conditions.push(eq(properties.propertyType, filters.propertyType));
  if (filters.municipality) conditions.push(eq(properties.municipality, filters.municipality));

  return db
    .select()
    .from(properties)
    .where(and(...conditions))
    .orderBy(desc(properties.createdAt))
    .limit(filters.limit ?? 200);
}

export async function getProperty(organizationId: string, id: string): Promise<Property | null> {
  const [row] = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.id, id),
        eq(properties.organizationId, organizationId),
        isNull(properties.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Imóveis com a mesma morada normalizada (para avisar de duplicados). */
export async function findPropertiesByAddress(
  organizationId: string,
  addressNormalized: string,
  excludeId?: string,
): Promise<Property[]> {
  if (!addressNormalized) return [];
  const conditions = [
    eq(properties.organizationId, organizationId),
    isNull(properties.deletedAt),
    eq(properties.addressNormalized, addressNormalized),
  ];
  if (excludeId) conditions.push(sql`${properties.id} <> ${excludeId}`);
  return db.select().from(properties).where(and(...conditions)).limit(5);
}

/** Concelhos distintos, para o filtro da lista e autocomplete. */
export async function listMunicipalities(organizationId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ municipality: properties.municipality })
    .from(properties)
    .where(
      and(
        eq(properties.organizationId, organizationId),
        isNull(properties.deletedAt),
        sql`${properties.municipality} is not null`,
      ),
    )
    .orderBy(asc(properties.municipality));
  return rows.map((r) => r.municipality!).filter(Boolean);
}

/** Freguesias distintas por concelho (autocomplete do formulário). */
export async function listParishes(organizationId: string): Promise<{ parish: string; municipality: string | null }[]> {
  const rows = await db
    .selectDistinct({ parish: properties.parish, municipality: properties.municipality })
    .from(properties)
    .where(
      and(
        eq(properties.organizationId, organizationId),
        isNull(properties.deletedAt),
        sql`${properties.parish} is not null`,
      ),
    )
    .orderBy(asc(properties.parish));
  return rows.filter((r) => r.parish).map((r) => ({ parish: r.parish!, municipality: r.municipality }));
}
