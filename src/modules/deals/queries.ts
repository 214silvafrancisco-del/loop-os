import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { contacts } from "@/modules/contacts/schema";
import { properties } from "@/modules/properties/schema";
import { dealStages, sourceChannels } from "@/modules/settings/schema";
import { deals, type Deal } from "./schema";

/** Linha da lista: negócio + colunas do imóvel, fase, fonte, responsável e contacto. */
export type DealListRow = {
  id: string;
  name: string | null;
  seq: number;
  status: Deal["status"];
  enteredAt: string;
  nextAction: string | null;
  nextActionDate: string | null;
  askingPrice: string | null;
  bpProfitNet: string | null;
  bpRoe: string | null;
  propertyId: string;
  ref: string;
  addressLine: string;
  parish: string | null;
  municipality: string | null;
  typology: string | null;
  floor: string | null;
  propertyType: (typeof properties.$inferSelect)["propertyType"];
  stageId: string;
  stageName: string;
  stageColor: string | null;
  stageIsPurchase: boolean;
  sourceName: string | null;
  ownerName: string | null;
  contactName: string | null;
  contactPhone: string | null;
};

export type DealListFilters = {
  q?: string;
  stageId?: string;
  status?: "active" | "excluded" | "all";
  municipality?: string;
  typology?: string;
  sourceChannelId?: string;
  ownerUserId?: string;
  limit?: number;
};

const listSelection = {
  id: deals.id,
  name: deals.name,
  seq: deals.seq,
  status: deals.status,
  enteredAt: deals.enteredAt,
  nextAction: deals.nextAction,
  nextActionDate: deals.nextActionDate,
  askingPrice: deals.askingPrice,
  bpProfitNet: deals.bpProfitNet,
  bpRoe: deals.bpRoe,
  propertyId: deals.propertyId,
  ref: properties.ref,
  addressLine: properties.addressLine,
  parish: properties.parish,
  municipality: properties.municipality,
  typology: properties.typology,
  floor: properties.floor,
  propertyType: properties.propertyType,
  stageId: deals.stageId,
  stageName: dealStages.name,
  stageColor: dealStages.color,
  stageIsPurchase: dealStages.isPurchase,
  sourceName: sourceChannels.name,
  ownerName: profiles.fullName,
  contactName: contacts.name,
  contactPhone: contacts.phone,
};

function baseQuery() {
  return db
    .select(listSelection)
    .from(deals)
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .innerJoin(dealStages, eq(deals.stageId, dealStages.id))
    .leftJoin(sourceChannels, eq(deals.sourceChannelId, sourceChannels.id))
    .leftJoin(profiles, eq(deals.ownerUserId, profiles.id))
    .leftJoin(contacts, eq(deals.sourceContactId, contacts.id));
}

export async function listDeals(
  organizationId: string,
  filters: DealListFilters = {},
): Promise<DealListRow[]> {
  const conditions = [eq(deals.organizationId, organizationId), isNull(deals.deletedAt)];

  const status = filters.status ?? "active";
  if (status !== "all") conditions.push(eq(deals.status, status));

  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(deals.name, pattern),
        ilike(properties.ref, pattern),
        ilike(properties.addressLine, pattern),
        ilike(properties.parish, pattern),
        ilike(properties.municipality, pattern),
        ilike(contacts.name, pattern),
        ilike(deals.nextAction, pattern),
      )!,
    );
  }
  if (filters.stageId) conditions.push(eq(deals.stageId, filters.stageId));
  if (filters.municipality) conditions.push(eq(properties.municipality, filters.municipality));
  if (filters.typology) conditions.push(eq(properties.typology, filters.typology));
  if (filters.sourceChannelId) conditions.push(eq(deals.sourceChannelId, filters.sourceChannelId));
  if (filters.ownerUserId) conditions.push(eq(deals.ownerUserId, filters.ownerUserId));

  return baseQuery()
    .where(and(...conditions))
    .orderBy(desc(deals.enteredAt), desc(deals.createdAt))
    .limit(filters.limit ?? 300);
}

export async function getDealRow(organizationId: string, id: string): Promise<DealListRow | null> {
  const [row] = await baseQuery()
    .where(and(eq(deals.id, id), eq(deals.organizationId, organizationId), isNull(deals.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getDeal(organizationId: string, id: string): Promise<Deal | null> {
  const [row] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.organizationId, organizationId), isNull(deals.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Negócios de um imóvel (histórico), mais antigos primeiro. */
export async function listDealsForProperty(organizationId: string, propertyId: string): Promise<DealListRow[]> {
  return baseQuery()
    .where(and(eq(deals.propertyId, propertyId), eq(deals.organizationId, organizationId), isNull(deals.deletedAt)))
    .orderBy(asc(deals.seq));
}

/** Contagens por fase (para o cabeçalho da lista e, no Step 07, dashboard e Kanban). */
export async function countDealsByStage(organizationId: string): Promise<{ stageId: string; count: number; askingTotal: string }[]> {
  return db
    .select({
      stageId: deals.stageId,
      count: sql<number>`count(*)::int`,
      askingTotal: sql<string>`coalesce(sum(${deals.askingPrice}), 0)::text`,
    })
    .from(deals)
    .where(and(eq(deals.organizationId, organizationId), eq(deals.status, "active"), isNull(deals.deletedAt)))
    .groupBy(deals.stageId);
}

/**
 * Negócios ativos com próxima ação até `until` (inclui atrasadas), por data.
 * Negócios com texto de ação mas sem data aparecem no fim.
 */
export async function listUpcomingActions(organizationId: string, until: string): Promise<DealListRow[]> {
  return baseQuery()
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.status, "active"),
        isNull(deals.deletedAt),
        or(sql`${deals.nextActionDate} <= ${until}`, and(isNull(deals.nextActionDate), sql`${deals.nextAction} is not null`))!,
      ),
    )
    .orderBy(sql`${deals.nextActionDate} asc nulls last`, desc(deals.enteredAt))
    .limit(50);
}

/** Negócios ativos (fora da fase de compra) sem próxima ação definida. */
export async function countDealsWithoutAction(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(deals)
    .innerJoin(dealStages, eq(deals.stageId, dealStages.id))
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.status, "active"),
        isNull(deals.deletedAt),
        isNull(deals.nextAction),
        isNull(deals.nextActionDate),
        eq(dealStages.isPurchase, false),
      ),
    );
  return row?.n ?? 0;
}

/** Compras com prazo de revenda IMT até `until`. */
export async function listImtDeadlines(organizationId: string, until: string): Promise<(DealListRow & { imtResaleDeadline: string | null; finalPrice: string | null })[]> {
  return db
    .select({ ...listSelection, imtResaleDeadline: deals.imtResaleDeadline, finalPrice: deals.finalPrice })
    .from(deals)
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .innerJoin(dealStages, eq(deals.stageId, dealStages.id))
    .leftJoin(sourceChannels, eq(deals.sourceChannelId, sourceChannels.id))
    .leftJoin(profiles, eq(deals.ownerUserId, profiles.id))
    .leftJoin(contacts, eq(deals.sourceContactId, contacts.id))
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.status, "active"),
        isNull(deals.deletedAt),
        sql`${deals.imtResaleDeadline} <= ${until}`,
        eq(properties.status, "owned"),
      ),
    )
    .orderBy(asc(deals.imtResaleDeadline));
}

/**
 * Imóveis comprados e ainda detidos, com o valor investido: valor final de
 * compra quando registado, senão o preço pedido (negócios importados do Notion
 * sem valor final).
 */
export async function sumPurchases(organizationId: string): Promise<{ count: number; total: string }> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(coalesce(${deals.finalPrice}, ${deals.askingPrice})), 0)::text`,
    })
    .from(deals)
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .innerJoin(dealStages, eq(deals.stageId, dealStages.id))
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.status, "active"),
        isNull(deals.deletedAt),
        eq(properties.status, "owned"),
        eq(dealStages.isPurchase, true),
      ),
    );
  return row ?? { count: 0, total: "0" };
}

/** Valores distintos para os filtros da lista. */
export async function listDealFilterOptions(organizationId: string): Promise<{ municipalities: string[]; typologies: string[] }> {
  const rows = await db
    .selectDistinct({ municipality: properties.municipality, typology: properties.typology })
    .from(deals)
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .where(and(eq(deals.organizationId, organizationId), isNull(deals.deletedAt)));
  const municipalities = [...new Set(rows.map((r) => r.municipality).filter((x): x is string => !!x))].sort();
  const typologies = [...new Set(rows.map((r) => r.typology).filter((x): x is string => !!x))].sort();
  return { municipalities, typologies };
}
