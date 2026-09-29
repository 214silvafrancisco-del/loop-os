import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { dealNotes } from "./schema";

export type DealNoteRow = {
  id: string;
  body: string;
  isPinned: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
};

export async function listDealNotes(organizationId: string, dealId: string): Promise<DealNoteRow[]> {
  return db
    .select({
      id: dealNotes.id,
      body: dealNotes.body,
      isPinned: dealNotes.isPinned,
      createdBy: dealNotes.createdBy,
      createdAt: dealNotes.createdAt,
      updatedAt: dealNotes.updatedAt,
      authorName: profiles.fullName,
    })
    .from(dealNotes)
    .leftJoin(profiles, eq(dealNotes.createdBy, profiles.id))
    .where(and(eq(dealNotes.organizationId, organizationId), eq(dealNotes.dealId, dealId)))
    .orderBy(desc(dealNotes.isPinned), desc(dealNotes.createdAt), asc(dealNotes.id));
}

export async function countDealNotes(organizationId: string, dealId: string): Promise<number> {
  const rows = await db
    .select({ id: dealNotes.id })
    .from(dealNotes)
    .where(and(eq(dealNotes.organizationId, organizationId), eq(dealNotes.dealId, dealId)));
  return rows.length;
}
