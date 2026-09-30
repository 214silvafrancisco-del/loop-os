import "server-only";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { properties } from "@/modules/properties/schema";
import { projectSuppliers, projects, type ProjectSupplier } from "../schema";

export type SupplierRow = ProjectSupplier & {
  /** Orçamentado sem IVA (folhas) deste fornecedor. */
  budgeted: number;
  chapterCount: number;
  measurementCount: number;
  invoiceCount: number;
};

/**
 * Subconsultas em SQL literal: interpolar `${projectSuppliers.id}` dentro de
 * uma subconsulta com alias fazia o Drizzle emitir a coluna sem tabela, que o
 * Postgres resolvia para a tabela interior (resultado 0).
 */
export async function listProjectSuppliers(organizationId: string, projectId: string): Promise<SupplierRow[]> {
  const rows = await db
    .select({
      supplier: projectSuppliers,
      budgeted: sql<string>`coalesce((select sum(b.budgeted) from budget_lines b where b.project_supplier_id = project_suppliers.id and not exists (select 1 from budget_lines c where c.parent_id = b.id)), 0)::text`,
      chapterCount: sql<number>`(select count(*)::int from budget_lines b where b.project_supplier_id = project_suppliers.id and b.parent_id is null)`,
      measurementCount: sql<number>`(select count(*)::int from measurement_reports m where m.project_supplier_id = project_suppliers.id)`,
      invoiceCount: sql<number>`(select count(*)::int from invoices i where i.project_supplier_id = project_suppliers.id and i.deleted_at is null)`,
    })
    .from(projectSuppliers)
    .where(and(eq(projectSuppliers.organizationId, organizationId), eq(projectSuppliers.projectId, projectId)))
    .orderBy(asc(projectSuppliers.sort), asc(projectSuppliers.createdAt));
  return rows.map((r) => ({ ...r.supplier, budgeted: Number(r.budgeted), chapterCount: r.chapterCount, measurementCount: r.measurementCount, invoiceCount: r.invoiceCount }));
}

export async function getProjectSupplier(organizationId: string, id: string): Promise<ProjectSupplier | null> {
  const [row] = await db
    .select()
    .from(projectSuppliers)
    .where(and(eq(projectSuppliers.id, id), eq(projectSuppliers.organizationId, organizationId)));
  return row ?? null;
}

export type ReusableSupplier = { name: string; kind: string | null; nif: string | null; phone: string | null; email: string | null; controlMode: "autos" | "fatura"; fromProject: string };

/** Fornecedores usados noutras obras (o mais recente por nome), para reutilizar sem voltar a escrever. */
export async function listReusableSuppliers(organizationId: string, projectId: string): Promise<ReusableSupplier[]> {
  const rows = await db
    .select({
      name: projectSuppliers.name,
      kind: projectSuppliers.kind,
      nif: projectSuppliers.nif,
      phone: projectSuppliers.phone,
      email: projectSuppliers.email,
      controlMode: projectSuppliers.controlMode,
      fromProject: sql<string>`${properties.ref} || ' · ' || ${projects.name}`,
      createdAt: projectSuppliers.createdAt,
    })
    .from(projectSuppliers)
    .innerJoin(projects, eq(projectSuppliers.projectId, projects.id))
    .innerJoin(properties, eq(projects.propertyId, properties.id))
    .where(and(eq(projectSuppliers.organizationId, organizationId), ne(projectSuppliers.projectId, projectId), ne(projectSuppliers.name, "Por atribuir")))
    .orderBy(desc(projectSuppliers.createdAt));
  const seen = new Set<string>();
  const out: ReusableSupplier[] = [];
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: r.name, kind: r.kind, nif: r.nif, phone: r.phone, email: r.email, controlMode: r.controlMode, fromProject: r.fromProject });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
