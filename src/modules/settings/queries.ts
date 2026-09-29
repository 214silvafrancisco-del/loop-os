import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { dealStages, sourceChannels, tags } from "./schema";

export type DealStage = typeof dealStages.$inferSelect;
export type SourceChannel = typeof sourceChannels.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type UserOption = { id: string; fullName: string; role: "admin" | "manager" | "user" };

export async function listDealStages(organizationId: string, onlyActive = true): Promise<DealStage[]> {
  return db
    .select()
    .from(dealStages)
    .where(
      onlyActive
        ? and(eq(dealStages.organizationId, organizationId), eq(dealStages.isActive, true))
        : eq(dealStages.organizationId, organizationId),
    )
    .orderBy(asc(dealStages.sort));
}

export async function listSourceChannels(organizationId: string): Promise<SourceChannel[]> {
  return db
    .select()
    .from(sourceChannels)
    .where(and(eq(sourceChannels.organizationId, organizationId), eq(sourceChannels.isActive, true)))
    .orderBy(asc(sourceChannels.sort));
}

export async function listTags(organizationId: string): Promise<Tag[]> {
  return db
    .select()
    .from(tags)
    .where(and(eq(tags.organizationId, organizationId), eq(tags.isActive, true)))
    .orderBy(asc(tags.sort), asc(tags.name));
}

/** Utilizadores ativos da organização, para "Responsável". */
export async function listUsers(organizationId: string): Promise<UserOption[]> {
  return db
    .select({ id: profiles.id, fullName: profiles.fullName, role: profiles.role })
    .from(profiles)
    .where(and(eq(profiles.organizationId, organizationId), eq(profiles.isActive, true)))
    .orderBy(asc(profiles.fullName));
}
