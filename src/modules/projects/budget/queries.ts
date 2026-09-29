import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { contacts } from "@/modules/contacts/schema";
import { budgetCategories } from "@/modules/settings/schema";
import { budgetLines, type BudgetLine } from "../schema";
import type { BudgetNode } from "./tree";

export async function listBudgetLines(organizationId: string, projectId: string): Promise<BudgetLine[]> {
  return db
    .select()
    .from(budgetLines)
    .where(and(eq(budgetLines.organizationId, organizationId), eq(budgetLines.projectId, projectId)))
    .orderBy(asc(budgetLines.depth), asc(budgetLines.sort));
}

export function lineToNode(l: BudgetLine): BudgetNode {
  return {
    id: l.id,
    parentId: l.parentId,
    sort: l.sort,
    description: l.description,
    categoryId: l.categoryId,
    supplierId: l.supplierId,
    quantity: l.quantity === null ? null : Number(l.quantity),
    unit: l.unit,
    unitPrice: l.unitPrice === null ? null : Number(l.unitPrice),
    vatRate: Number(l.vatRate),
    notes: l.notes,
  };
}

/** Fornecedores (contactos com papel fornecedor), com os restantes contactos a seguir. */
export async function listSupplierOptions(organizationId: string): Promise<{ id: string; name: string; isSupplier: boolean }[]> {
  const rows = await db
    .select({ id: contacts.id, name: contacts.name, companyName: contacts.companyName, roles: contacts.roles })
    .from(contacts)
    .where(and(eq(contacts.organizationId, organizationId), isNull(contacts.deletedAt)))
    .orderBy(asc(contacts.name));
  return rows
    .map((c) => ({ id: c.id, name: c.companyName ? `${c.name} · ${c.companyName}` : c.name, isSupplier: c.roles.includes("fornecedor") }))
    .sort((a, b) => Number(b.isSupplier) - Number(a.isSupplier) || a.name.localeCompare(b.name));
}

export async function listBudgetCategories(organizationId: string) {
  return db
    .select({ id: budgetCategories.id, name: budgetCategories.name, code: budgetCategories.code })
    .from(budgetCategories)
    .where(and(eq(budgetCategories.organizationId, organizationId), eq(budgetCategories.isActive, true)))
    .orderBy(asc(budgetCategories.sort));
}

/** Total orçamentado (folhas) de uma obra, para cabeçalhos e dashboard. */
export async function sumBudget(organizationId: string, projectId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${budgetLines.budgeted}), 0)::text` })
    .from(budgetLines)
    .where(
      and(
        eq(budgetLines.organizationId, organizationId),
        eq(budgetLines.projectId, projectId),
        sql`not exists (select 1 from ${budgetLines} c where c.parent_id = ${budgetLines.id})`,
      ),
    );
  return Number(row?.total ?? 0);
}
