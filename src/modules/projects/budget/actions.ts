"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { getActiveScenarioForDeal } from "@/modules/business-plan/queries";
import { budgetLines, projectSuppliers, projects } from "../schema";
import { assignCodes, chaptersWithoutSupplier, computeTotals, depthOf, inheritSuppliers, isLeaf, type BudgetNode } from "./tree";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const nodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().nullable(),
  sort: z.number().int().min(0),
  description: z.string().trim().min(1, "Cada linha precisa de descrição.").max(2000),
  categoryId: z.uuid().nullable(),
  supplierId: z.uuid().nullable(),
  quantity: z.number().min(0).nullable(),
  unit: z.string().trim().max(20).nullable(),
  unitPrice: z.number().min(0).nullable(),
  vatRate: z.number().min(0).max(1),
  notes: z.string().trim().max(2000).nullable(),
});

async function ownProject(organizationId: string, projectId: string) {
  const [p] = await db
    .select({ id: projects.id, dealId: projects.dealId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
  return p ?? null;
}

/**
 * Guarda a árvore completa: linhas com id `tmp-…` são criadas (por ordem de
 * profundidade, para os pais existirem), as restantes atualizadas, e as que
 * desapareceram são apagadas.
 */
export async function saveBudget(projectId: string, rawNodes: unknown): Promise<Result<{ idMap: Record<string, string> }>> {
  const user = await requireUser();
  const parsed = z.array(nodeSchema).max(2000).safeParse(rawNodes);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const project = await ownProject(user.organizationId, projectId);
  if (!project) return { ok: false, error: "Obra não encontrada." };

  // O fornecedor define-se no capítulo e copia-se para todas as linhas dele.
  const nodes: BudgetNode[] = inheritSuppliers(parsed.data);
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    if (n.parentId && !ids.has(n.parentId)) return { ok: false, error: "Linha com pai inexistente." };
  }
  const missing = chaptersWithoutSupplier(nodes);
  if (missing.length) return { ok: false, error: `Sem fornecedor: ${missing.map((c) => c.description || "capítulo sem nome").join(", ")}. Cada capítulo pertence a um fornecedor da obra.` };
  const validSuppliers = new Set(
    (await db.select({ id: projectSuppliers.id }).from(projectSuppliers).where(eq(projectSuppliers.projectId, projectId))).map((s) => s.id),
  );
  if (nodes.some((n) => n.supplierId && !validSuppliers.has(n.supplierId))) return { ok: false, error: "Fornecedor inválido para esta obra." };
  const codes = assignCodes(nodes);
  const totals = computeTotals(nodes);

  const idMap: Record<string, string> = {};
  await db.transaction(async (tx) => {
    // Pais primeiro: ordenar por profundidade.
    const ordered = [...nodes].sort((a, b) => depthOf(nodes, a.id) - depthOf(nodes, b.id));
    for (const n of ordered) {
      const parentId = n.parentId ? (idMap[n.parentId] ?? n.parentId) : null;
      const leaf = isLeaf(nodes, n.id);
      const values = {
        parentId,
        depth: depthOf(nodes, n.id),
        code: codes[n.id] ?? null,
        sort: n.sort,
        categoryId: n.categoryId,
        description: n.description,
        projectSupplierId: n.supplierId,
        quantity: leaf && n.quantity !== null ? n.quantity.toFixed(3) : null,
        unit: leaf ? n.unit : null,
        unitPrice: leaf && n.unitPrice !== null ? n.unitPrice.toFixed(4) : null,
        budgeted: (totals.byNode[n.id] ?? 0).toFixed(2),
        vatRate: n.vatRate.toFixed(4),
        notes: n.notes,
        updatedBy: user.id,
      };
      if (n.id.startsWith("tmp-")) {
        const [created] = await tx
          .insert(budgetLines)
          .values({ ...values, organizationId: user.organizationId, projectId, createdBy: user.id })
          .returning({ id: budgetLines.id });
        idMap[n.id] = created!.id;
      } else {
        idMap[n.id] = n.id;
        await tx
          .update(budgetLines)
          .set(values)
          .where(and(eq(budgetLines.id, n.id), eq(budgetLines.projectId, projectId)));
      }
    }
    const keep = Object.values(idMap);
    if (keep.length) await tx.delete(budgetLines).where(and(eq(budgetLines.projectId, projectId), notInArray(budgetLines.id, keep)));
    else await tx.delete(budgetLines).where(eq(budgetLines.projectId, projectId));
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { ok: true, idMap };
}

/** Orçamento vazio: começa com um capítulo "Geral" e o valor de obra do Business Plan. */
export async function seedBudgetFromBusinessPlan(projectId: string): Promise<Result<{ amount: number }>> {
  const user = await requireUser();
  const project = await ownProject(user.organizationId, projectId);
  if (!project) return { ok: false, error: "Obra não encontrada." };
  const existing = await db.select({ id: budgetLines.id }).from(budgetLines).where(eq(budgetLines.projectId, projectId)).limit(1);
  if (existing.length) return { ok: false, error: "O orçamento já tem linhas." };
  const scenario = await getActiveScenarioForDeal(user.organizationId, project.dealId);
  const amount = Number(scenario?.worksBudget ?? 0);
  if (!amount) return { ok: false, error: "O cenário ativo do Business Plan não tem orçamento de obra." };

  await db.transaction(async (tx) => {
    // Precisa de um fornecedor: usa o primeiro da obra ou cria "Empreiteiro".
    let [supplier] = await tx.select({ id: projectSuppliers.id }).from(projectSuppliers).where(eq(projectSuppliers.projectId, projectId)).orderBy(projectSuppliers.sort).limit(1);
    if (!supplier) {
      [supplier] = await tx
        .insert(projectSuppliers)
        .values({ organizationId: user.organizationId, projectId, name: "Empreiteiro", kind: "Empreiteiro", controlMode: "autos", sort: 1, createdBy: user.id, updatedBy: user.id })
        .returning({ id: projectSuppliers.id });
    }
    const [chapter] = await tx
      .insert(budgetLines)
      .values({ organizationId: user.organizationId, projectId, projectSupplierId: supplier!.id, depth: 0, code: "1", sort: 1, description: "Geral", budgeted: amount.toFixed(2), createdBy: user.id, updatedBy: user.id })
      .returning({ id: budgetLines.id });
    await tx.insert(budgetLines).values({
      organizationId: user.organizationId,
      projectId,
      projectSupplierId: supplier!.id,
      parentId: chapter!.id,
      depth: 1,
      code: "1.1",
      sort: 1,
      description: "Orçamento estimado no Business Plan (substituir pelo mapa de quantidades)",
      quantity: "1.000",
      unit: "vg",
      unitPrice: amount.toFixed(4),
      budgeted: amount.toFixed(2),
      vatRate: scenario?.worksVatPct ?? "0.2300",
      createdBy: user.id,
      updatedBy: user.id,
    });
  });
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true, amount };
}

export async function deleteBudgetLinesByIds(projectId: string, ids: string[]): Promise<Result> {
  const user = await requireUser();
  const project = await ownProject(user.organizationId, projectId);
  if (!project) return { ok: false, error: "Obra não encontrada." };
  if (ids.length) await db.delete(budgetLines).where(and(eq(budgetLines.projectId, projectId), inArray(budgetLines.id, ids)));
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true };
}
