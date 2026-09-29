"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { fieldErrorsOf } from "@/core/lib/form-schemas";
import { getActiveScenarioForDeal } from "@/modules/business-plan/queries";
import { deals } from "@/modules/deals/schema";
import { dealStages } from "@/modules/settings/schema";
import { getProjectForDeal } from "./queries";
import { projects } from "./schema";
import { addDays, addMonths, projectUpdateInputFromForm, projectUpdateSchema, type ProjectUpdateInput } from "./validation";

export type ProjectFormState = { error?: string; fieldErrors?: Record<string, string>; values?: ProjectUpdateInput };

/**
 * "Criar obra" no negócio comprado. Exige fase de compra e escritura. Datas
 * previstas: início 15 dias após a escritura; fim = início + meses de
 * retenção do cenário ativo (ou 4). O orçamento vem no Step 14.
 */
export async function createProjectFromDeal(dealId: string): Promise<{ ok: false; error: string } | never> {
  const user = await requireUser();
  const [row] = await db
    .select({ deal: deals, isPurchase: dealStages.isPurchase })
    .from(deals)
    .innerJoin(dealStages, eq(deals.stageId, dealStages.id))
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, user.organizationId), isNull(deals.deletedAt)));
  if (!row) return { ok: false, error: "Negócio não encontrado." };
  if (!row.isPurchase || !row.deal.deedDate) return { ok: false, error: "A obra só pode ser criada depois da escritura." };

  const existing = await getProjectForDeal(user.organizationId, dealId);
  if (existing) redirect(`/projects/${existing.id}`);

  const scenario = await getActiveScenarioForDeal(user.organizationId, dealId);
  const months = scenario ? Math.max(1, scenario.holdingMonths - 1) : 4;
  const plannedStart = addDays(row.deal.deedDate, 15);
  const plannedEnd = addMonths(plannedStart, months);

  const [created] = await db
    .insert(projects)
    .values({
      organizationId: user.organizationId,
      propertyId: row.deal.propertyId,
      dealId,
      name: row.deal.name ?? "Obra",
      status: "planeamento",
      managerUserId: user.id,
      plannedStart,
      plannedEnd,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: projects.id });

  revalidatePath("/projects");
  revalidatePath(`/deals/${dealId}`, "layout");
  revalidatePath("/dashboard");
  redirect(`/projects/${created!.id}`);
}

export async function updateProject(id: string, _prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const user = await requireUser();
  const values = projectUpdateInputFromForm(formData);
  const parsed = projectUpdateSchema.safeParse(values);
  if (!parsed.success) return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues), values };

  const d = parsed.data;
  if (d.actualStart && d.actualEnd && d.actualEnd < d.actualStart) {
    return { error: "Corrige os campos assinalados.", fieldErrors: { actualEnd: "Antes do início." }, values };
  }
  const res = await db
    .update(projects)
    .set({ ...d, updatedBy: user.id })
    .where(and(eq(projects.id, id), eq(projects.organizationId, user.organizationId), isNull(projects.deletedAt)))
    .returning({ id: projects.id });
  if (!res.length) return { error: "Obra não encontrada." };

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`, "layout");
  revalidatePath("/dashboard");
  redirect(`/projects/${id}/resumo`);
}

/** Mudança rápida de estado pelo cabeçalho. Em curso preenche o início real; concluída o fim real. */
export async function setProjectStatus(id: string, status: (typeof projects.$inferSelect)["status"]): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const [project] = await db
    .select({ actualStart: projects.actualStart, actualEnd: projects.actualEnd })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, user.organizationId), isNull(projects.deletedAt)));
  if (!project) return { ok: false, error: "Obra não encontrada." };
  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(projects)
    .set({
      status,
      actualStart: status === "em_curso" && !project.actualStart ? today : undefined,
      actualEnd: status === "concluida" && !project.actualEnd ? today : undefined,
      updatedBy: user.id,
    })
    .where(eq(projects.id, id));
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`, "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}
