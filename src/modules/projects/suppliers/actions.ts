"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { dbErrorMessage } from "@/core/db/errors";
import { budgetLines, invoices, measurementReports, projectSuppliers, projects } from "../schema";
import { getProjectSupplier } from "./queries";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const optional = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Indica o nome do fornecedor.").max(200),
  kind: optional,
  nif: optional.transform((v, ctx) => {
    if (v && !/^\d{9}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "NIF com 9 dígitos." });
      return z.NEVER;
    }
    return v;
  }),
  phone: optional,
  email: optional,
  controlMode: z.enum(["autos", "fatura"]),
  notes: optional,
});
export type SupplierInput = z.input<typeof supplierSchema>;

async function ownProject(organizationId: string, projectId: string) {
  const [p] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
  return p ?? null;
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function createProjectSupplier(projectId: string, raw: unknown): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = supplierSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!(await ownProject(user.organizationId, projectId))) return { ok: false, error: "Obra não encontrada." };
  const [max] = await db
    .select({ sort: sql<number>`coalesce(max(${projectSuppliers.sort}), 0)::int` })
    .from(projectSuppliers)
    .where(eq(projectSuppliers.projectId, projectId));
  try {
    const [created] = await db
      .insert(projectSuppliers)
      .values({ organizationId: user.organizationId, projectId, ...parsed.data, sort: (max?.sort ?? 0) + 1, createdBy: user.id, updatedBy: user.id })
      .returning({ id: projectSuppliers.id });
    revalidate(projectId);
    return { ok: true, id: created!.id };
  } catch (e) {
    if (dbErrorMessage(e).includes("project_suppliers_project_name_idx")) return { ok: false, error: "Já existe um fornecedor com esse nome nesta obra." };
    throw e;
  }
}

export async function updateProjectSupplier(id: string, raw: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = supplierSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const existing = await getProjectSupplier(user.organizationId, id);
  if (!existing) return { ok: false, error: "Fornecedor não encontrado." };
  try {
    await db.update(projectSuppliers).set({ ...parsed.data, updatedBy: user.id }).where(eq(projectSuppliers.id, id));
  } catch (e) {
    if (dbErrorMessage(e).includes("project_suppliers_project_name_idx")) return { ok: false, error: "Já existe um fornecedor com esse nome nesta obra." };
    throw e;
  }
  revalidate(existing.projectId);
  return { ok: true };
}

/** Só se não tiver orçamento, autos nem faturas. */
export async function deleteProjectSupplier(id: string): Promise<Result> {
  const user = await requireUser();
  const existing = await getProjectSupplier(user.organizationId, id);
  if (!existing) return { ok: false, error: "Fornecedor não encontrado." };
  const [use] = await db.select({
    lines: sql<number>`(select count(*)::int from ${budgetLines} b where b.project_supplier_id = ${id})`,
    autos: sql<number>`(select count(*)::int from ${measurementReports} m where m.project_supplier_id = ${id})`,
    faturas: sql<number>`(select count(*)::int from ${invoices} i where i.project_supplier_id = ${id})`,
  }).from(projectSuppliers).where(eq(projectSuppliers.id, id));
  if (use && (use.lines || use.autos || use.faturas)) {
    return { ok: false, error: "Este fornecedor tem orçamento, autos ou faturas. Move-os primeiro para outro fornecedor." };
  }
  await db.delete(projectSuppliers).where(eq(projectSuppliers.id, id));
  revalidate(existing.projectId);
  return { ok: true };
}
