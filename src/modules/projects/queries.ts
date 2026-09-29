import "server-only";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { deals } from "@/modules/deals/schema";
import { properties } from "@/modules/properties/schema";
import { projects, type Project } from "./schema";
import type { ProjectStatus } from "./validation";

export type ProjectRow = {
  id: string;
  name: string;
  status: Project["status"];
  plannedStart: string | null;
  actualStart: string | null;
  plannedEnd: string | null;
  actualEnd: string | null;
  propertyId: string;
  dealId: string;
  ref: string;
  addressLine: string;
  parish: string | null;
  municipality: string | null;
  typology: string | null;
  managerName: string | null;
  finalPrice: string | null;
  createdAt: Date;
};

const selection = {
  id: projects.id,
  name: projects.name,
  status: projects.status,
  plannedStart: projects.plannedStart,
  actualStart: projects.actualStart,
  plannedEnd: projects.plannedEnd,
  actualEnd: projects.actualEnd,
  propertyId: projects.propertyId,
  dealId: projects.dealId,
  ref: properties.ref,
  addressLine: properties.addressLine,
  parish: properties.parish,
  municipality: properties.municipality,
  typology: properties.typology,
  managerName: profiles.fullName,
  finalPrice: deals.finalPrice,
  createdAt: projects.createdAt,
};

function base() {
  return db
    .select(selection)
    .from(projects)
    .innerJoin(properties, eq(projects.propertyId, properties.id))
    .innerJoin(deals, eq(projects.dealId, deals.id))
    .leftJoin(profiles, eq(projects.managerUserId, profiles.id));
}

export type ProjectListFilters = { q?: string; status?: ProjectStatus; managerUserId?: string };

export async function listProjects(organizationId: string, filters: ProjectListFilters = {}): Promise<ProjectRow[]> {
  const conditions = [eq(projects.organizationId, organizationId), isNull(projects.deletedAt)];
  const q = filters.q?.trim();
  if (q) {
    const p = `%${q}%`;
    conditions.push(or(ilike(projects.name, p), ilike(properties.ref, p), ilike(properties.addressLine, p), ilike(properties.parish, p))!);
  }
  if (filters.status) conditions.push(eq(projects.status, filters.status));
  if (filters.managerUserId) conditions.push(eq(projects.managerUserId, filters.managerUserId));
  return base().where(and(...conditions)).orderBy(desc(projects.createdAt));
}

export async function getProject(organizationId: string, id: string): Promise<Project | null> {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId), isNull(projects.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getProjectRow(organizationId: string, id: string): Promise<ProjectRow | null> {
  const [row] = await base()
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId), isNull(projects.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Obra ativa (não cancelada) de um negócio, para o botão do cabeçalho. */
export async function getProjectForDeal(organizationId: string, dealId: string): Promise<Pick<Project, "id" | "name" | "status"> | null> {
  const [row] = await db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(and(eq(projects.dealId, dealId), eq(projects.organizationId, organizationId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listProjectsForProperty(organizationId: string, propertyId: string): Promise<ProjectRow[]> {
  return base()
    .where(and(eq(projects.propertyId, propertyId), eq(projects.organizationId, organizationId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.createdAt));
}
