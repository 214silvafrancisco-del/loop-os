import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { contacts } from "@/modules/contacts/schema";
import { deals } from "@/modules/deals/schema";
import { properties } from "@/modules/properties/schema";
import { saleAgencies, saleLeads, sales, type Sale, type SaleStage } from "./schema";

export type SaleListRow = {
  id: string;
  stage: SaleStage;
  propertyId: string;
  ref: string;
  addressLine: string;
  parish: string | null;
  municipality: string | null;
  typology: string | null;
  floor: string | null;
  dealId: string | null;
  dealName: string | null;
  projectId: string | null;
  listingPrice: string | null;
  listingDate: string | null;
  salePrice: string | null;
  deedDate: string | null;
  ownerName: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  /** Leads ainda em aberto (sem ganho/perdido) e total. */
  leadsOpen: number;
  leadsTotal: number;
  /** Nomes das mediadoras, separados por " · ". */
  agencies: string | null;
};

// SQL literal nas subconsultas correlacionadas: `${sales.id}` dentro de uma subconsulta com alias sai sem a tabela.
const leadsOpenSql = sql<number>`(select count(*)::int from sale_leads l where l.sale_id = sales.id and l.status not in ('ganho', 'perdido'))`;
const leadsTotalSql = sql<number>`(select count(*)::int from sale_leads l where l.sale_id = sales.id)`;
const agenciesSql = sql<string | null>`(select string_agg(c.name, ' · ' order by a.created_at) from sale_agencies a join contacts c on c.id = a.contact_id where a.sale_id = sales.id)`;

const listSelection = {
  id: sales.id,
  stage: sales.stage,
  propertyId: sales.propertyId,
  ref: properties.ref,
  addressLine: properties.addressLine,
  parish: properties.parish,
  municipality: properties.municipality,
  typology: properties.typology,
  floor: properties.floor,
  dealId: sales.dealId,
  dealName: deals.name,
  projectId: sales.projectId,
  listingPrice: sales.listingPrice,
  listingDate: sales.listingDate,
  salePrice: sales.salePrice,
  deedDate: sales.deedDate,
  ownerName: profiles.fullName,
  nextAction: sales.nextAction,
  nextActionDate: sales.nextActionDate,
  leadsOpen: leadsOpenSql,
  leadsTotal: leadsTotalSql,
  agencies: agenciesSql,
};

function baseQuery() {
  return db
    .select(listSelection)
    .from(sales)
    .innerJoin(properties, eq(sales.propertyId, properties.id))
    .leftJoin(deals, eq(sales.dealId, deals.id))
    .leftJoin(profiles, eq(sales.ownerUserId, profiles.id));
}

export type SaleListFilters = {
  q?: string;
  stage?: SaleStage;
  ownerUserId?: string;
  /** "open" (por defeito): sem vendidas/canceladas; "closed": só essas; "all": todas. */
  scope?: "open" | "closed" | "all";
};

const STAGE_ORDER = sql`case ${sales.stage} when 'preparacao' then 1 when 'a_venda' then 2 when 'cpcv' then 3 when 'vendido' then 4 else 5 end`;

export async function listSales(organizationId: string, filters: SaleListFilters = {}): Promise<SaleListRow[]> {
  const conditions = [eq(sales.organizationId, organizationId), isNull(sales.deletedAt)];
  const scope = filters.scope ?? "open";
  if (scope === "open") conditions.push(inArray(sales.stage, ["preparacao", "a_venda", "cpcv"]));
  if (scope === "closed") conditions.push(inArray(sales.stage, ["vendido", "cancelada"]));
  if (filters.stage) conditions.push(eq(sales.stage, filters.stage));
  if (filters.ownerUserId) conditions.push(eq(sales.ownerUserId, filters.ownerUserId));
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(or(ilike(properties.ref, pattern), ilike(properties.addressLine, pattern), ilike(properties.parish, pattern), ilike(deals.name, pattern))!);
  }
  return baseQuery()
    .where(and(...conditions))
    .orderBy(STAGE_ORDER, asc(properties.ref), desc(sales.createdAt));
}

export async function countSalesByStage(organizationId: string): Promise<{ stage: SaleStage; count: number; listingTotal: string }[]> {
  return db
    .select({ stage: sales.stage, count: sql<number>`count(*)::int`, listingTotal: sql<string>`coalesce(sum(${sales.listingPrice}), 0)::text` })
    .from(sales)
    .where(and(eq(sales.organizationId, organizationId), isNull(sales.deletedAt)))
    .groupBy(sales.stage);
}

export async function getSale(organizationId: string, id: string): Promise<Sale | null> {
  const [row] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.organizationId, organizationId), isNull(sales.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getSaleRow(organizationId: string, id: string): Promise<SaleListRow | null> {
  const [row] = await baseQuery()
    .where(and(eq(sales.id, id), eq(sales.organizationId, organizationId), isNull(sales.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Venda (não cancelada) ligada a um negócio: para o botão «Ver venda» na ficha. */
export async function getSaleForDeal(organizationId: string, dealId: string): Promise<{ id: string; stage: SaleStage } | null> {
  const [row] = await db
    .select({ id: sales.id, stage: sales.stage })
    .from(sales)
    .where(and(eq(sales.organizationId, organizationId), eq(sales.dealId, dealId), isNull(sales.deletedAt), sql`${sales.stage} <> 'cancelada'`))
    .orderBy(desc(sales.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getActiveSaleForProperty(organizationId: string, propertyId: string): Promise<{ id: string; stage: SaleStage } | null> {
  const [row] = await db
    .select({ id: sales.id, stage: sales.stage })
    .from(sales)
    .where(and(eq(sales.organizationId, organizationId), eq(sales.propertyId, propertyId), isNull(sales.deletedAt), sql`${sales.stage} <> 'cancelada'`))
    .orderBy(desc(sales.createdAt))
    .limit(1);
  return row ?? null;
}

export type SaleAgencyRow = {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  contactCompany: string | null;
  commissionPct: string | null;
  commissionFixed: string | null;
  commissionVatPct: string;
  exclusive: boolean;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  /** Leads que entraram por esta mediadora. */
  leadsCount: number;
};

export async function listSaleAgencies(organizationId: string, saleId: string): Promise<SaleAgencyRow[]> {
  return db
    .select({
      id: saleAgencies.id,
      contactId: saleAgencies.contactId,
      contactName: contacts.name,
      contactPhone: contacts.phone,
      contactCompany: contacts.companyName,
      commissionPct: saleAgencies.commissionPct,
      commissionFixed: saleAgencies.commissionFixed,
      commissionVatPct: saleAgencies.commissionVatPct,
      exclusive: saleAgencies.exclusive,
      startDate: saleAgencies.startDate,
      endDate: saleAgencies.endDate,
      notes: saleAgencies.notes,
      leadsCount: sql<number>`(select count(*)::int from sale_leads l where l.agency_id = sale_agencies.id)`,
    })
    .from(saleAgencies)
    .innerJoin(contacts, eq(saleAgencies.contactId, contacts.id))
    .where(and(eq(saleAgencies.organizationId, organizationId), eq(saleAgencies.saleId, saleId)))
    .orderBy(asc(saleAgencies.createdAt));
}

export type SaleLeadRow = typeof saleLeads.$inferSelect & { agencyName: string | null };

export async function listSaleLeads(organizationId: string, saleId: string): Promise<SaleLeadRow[]> {
  const rows = await db
    .select({ lead: saleLeads, agencyName: contacts.name })
    .from(saleLeads)
    .leftJoin(saleAgencies, eq(saleLeads.agencyId, saleAgencies.id))
    .leftJoin(contacts, eq(saleAgencies.contactId, contacts.id))
    .where(and(eq(saleLeads.organizationId, organizationId), eq(saleLeads.saleId, saleId)))
    .orderBy(sql`case ${saleLeads.status} when 'ganho' then 2 when 'perdido' then 3 else 1 end`, sql`${saleLeads.nextActionDate} asc nulls last`, desc(saleLeads.createdAt));
  return rows.map((r) => ({ ...r.lead, agencyName: r.agencyName }));
}

/** Imóveis detidos sem venda ativa: para «Nova venda» a partir da lista. */
export async function listSellableProperties(organizationId: string): Promise<{ id: string; ref: string; addressLine: string; dealId: string | null; dealName: string | null }[]> {
  return db
    .select({
      id: properties.id,
      ref: properties.ref,
      addressLine: properties.addressLine,
      dealId: sql<string | null>`(select d.id from deals d where d.property_id = properties.id and d.deleted_at is null and d.status = 'active' order by d.seq desc limit 1)`,
      dealName: sql<string | null>`(select d.name from deals d where d.property_id = properties.id and d.deleted_at is null and d.status = 'active' order by d.seq desc limit 1)`,
    })
    .from(properties)
    .where(
      and(
        eq(properties.organizationId, organizationId),
        isNull(properties.deletedAt),
        inArray(properties.status, ["owned", "for_sale"]),
        sql`not exists (select 1 from sales s where s.property_id = properties.id and s.deleted_at is null and s.stage <> 'cancelada')`,
      ),
    )
    .orderBy(asc(properties.ref));
}

/** Leads com próxima ação até `until` (inclui atrasadas), para o dashboard e o resumo diário. */
export async function listLeadActions(organizationId: string, until: string): Promise<{ id: string; saleId: string; name: string; ref: string; nextAction: string | null; nextActionDate: string | null }[]> {
  return db
    .select({ id: saleLeads.id, saleId: saleLeads.saleId, name: saleLeads.name, ref: properties.ref, nextAction: saleLeads.nextAction, nextActionDate: saleLeads.nextActionDate })
    .from(saleLeads)
    .innerJoin(properties, eq(saleLeads.propertyId, properties.id))
    .where(and(eq(saleLeads.organizationId, organizationId), sql`${saleLeads.nextActionDate} <= ${until}`, sql`${saleLeads.status} not in ('ganho', 'perdido')`))
    .orderBy(asc(saleLeads.nextActionDate))
    .limit(50);
}
