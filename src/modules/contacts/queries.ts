import "server-only";
import { and, arrayContains, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { contacts, type Contact, type ContactRole } from "./schema";

export type ContactListFilters = {
  q?: string;
  role?: ContactRole;
  limit?: number;
};

export async function listContacts(
  organizationId: string,
  filters: ContactListFilters = {},
): Promise<Contact[]> {
  const conditions = [eq(contacts.organizationId, organizationId), isNull(contacts.deletedAt)];

  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(contacts.name, pattern),
        ilike(contacts.companyName, pattern),
        ilike(contacts.email, pattern),
        ilike(contacts.phone, pattern),
        ilike(contacts.nif, pattern),
      )!,
    );
  }
  if (filters.role) {
    conditions.push(arrayContains(contacts.roles, [filters.role]));
  }

  return db
    .select()
    .from(contacts)
    .where(and(...conditions))
    .orderBy(asc(contacts.name))
    .limit(filters.limit ?? 200);
}

export async function getContact(
  organizationId: string,
  id: string,
): Promise<Contact | null> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, id),
        eq(contacts.organizationId, organizationId),
        isNull(contacts.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Contactos com o mesmo telefone normalizado ou NIF (para avisar de duplicados). */
export async function findDuplicateContacts(
  organizationId: string,
  input: { phoneNormalized: string | null; nif: string | null; excludeId?: string },
): Promise<Contact[]> {
  const matchers = [];
  if (input.phoneNormalized) matchers.push(eq(contacts.phoneNormalized, input.phoneNormalized));
  if (input.nif) matchers.push(eq(contacts.nif, input.nif));
  if (matchers.length === 0) return [];

  const conditions = [
    eq(contacts.organizationId, organizationId),
    isNull(contacts.deletedAt),
    or(...matchers)!,
  ];
  if (input.excludeId) conditions.push(sql`${contacts.id} <> ${input.excludeId}`);

  return db.select().from(contacts).where(and(...conditions)).limit(5);
}

export async function countContacts(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contacts)
    .where(and(eq(contacts.organizationId, organizationId), isNull(contacts.deletedAt)));
  return row?.n ?? 0;
}
