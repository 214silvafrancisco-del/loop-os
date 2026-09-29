"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { deals } from "@/modules/deals/schema";
import { CALC_VERSION, calcScenario, type ScenarioOutputs } from "./calc";
import { inputsToScenarioColumns, outputsToColumns, scenarioRowToInputs } from "./mapper";
import { getImtContext, getScenario, listScenarios } from "./queries";
import { bpScenarios, businessPlans } from "./schema";
import { getDealContext, propertyContextOf, writeDealCache } from "./service";
import { scenarioInputsSchema } from "./validation";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function planOfScenario(organizationId: string, scenarioId: string) {
  const [row] = await db
    .select({ scenarioId: bpScenarios.id, planId: businessPlans.id, dealId: businessPlans.dealId, isActive: bpScenarios.isActive })
    .from(bpScenarios)
    .innerJoin(businessPlans, eq(bpScenarios.businessPlanId, businessPlans.id))
    .where(and(eq(bpScenarios.id, scenarioId), eq(bpScenarios.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

function revalidateDeal(dealId: string) {
  revalidatePath(`/deals/${dealId}/business-plan`);
  revalidatePath(`/deals/${dealId}`, "layout");
  revalidatePath("/deals");
  revalidatePath("/dashboard");
}

/** Guarda os inputs de um cenário e recalcula o snapshot. */
export async function saveScenario(scenarioId: string, rawInputs: unknown): Promise<Result<{ outputs: ScenarioOutputs }>> {
  const user = await requireUser();
  const parsed = scenarioInputsSchema.safeParse(rawInputs);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const link = await planOfScenario(user.organizationId, scenarioId);
  if (!link) return { ok: false, error: "Cenário não encontrado." };

  const dealCtx = await getDealContext(user.organizationId, link.dealId);
  if (!dealCtx) return { ok: false, error: "Negócio não encontrado." };
  const { ctx } = await getImtContext(user.organizationId);

  // A área bruta é do imóvel: o motor usa a do cliente para pré-visualizar,
  // mas ao gravar prevalece a da ficha do imóvel.
  const inputs = { ...parsed.data, grossArea: propertyContextOf(dealCtx).grossArea };
  const outputs = calcScenario(inputs, ctx);

  await db
    .update(bpScenarios)
    .set({ ...inputsToScenarioColumns(inputs), ...outputsToColumns(outputs, CALC_VERSION), updatedBy: user.id })
    .where(eq(bpScenarios.id, scenarioId));
  if (link.isActive) await writeDealCache(link.dealId, scenarioId, outputs, user.id);

  revalidateDeal(link.dealId);
  return { ok: true, outputs };
}

/** Define o cenário que alimenta a lista, o Kanban e o dashboard. */
export async function setActiveScenario(scenarioId: string): Promise<Result> {
  const user = await requireUser();
  const link = await planOfScenario(user.organizationId, scenarioId);
  if (!link) return { ok: false, error: "Cenário não encontrado." };

  await db.update(bpScenarios).set({ isActive: false, updatedBy: user.id }).where(eq(bpScenarios.businessPlanId, link.planId));
  await db.update(bpScenarios).set({ isActive: true, updatedBy: user.id }).where(eq(bpScenarios.id, scenarioId));

  const scenario = await getScenario(user.organizationId, scenarioId);
  const dealCtx = await getDealContext(user.organizationId, link.dealId);
  if (scenario && dealCtx) {
    const { ctx } = await getImtContext(user.organizationId);
    const outputs = calcScenario(scenarioRowToInputs(scenario, propertyContextOf(dealCtx)), ctx);
    await writeDealCache(link.dealId, scenarioId, outputs, user.id);
  }
  revalidateDeal(link.dealId);
  return { ok: true };
}

/** Novo cenário, copiado de outro (ou do primeiro). */
export async function addScenario(businessPlanId: string, name: string, copyFromId?: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: "Dá um nome ao cenário." };
  const scenarios = await listScenarios(user.organizationId, businessPlanId);
  if (scenarios.length === 0) return { ok: false, error: "Business Plan não encontrado." };
  if (scenarios.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return { ok: false, error: "Já existe um cenário com esse nome." };
  const source = scenarios.find((s) => s.id === copyFromId) ?? scenarios[0]!;

  // Copiar todas as colunas de input, sem id/nome/estado.
  const {
    id: _id, name: _name, kind: _kind, sort: _sort, isActive: _active, createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub,
    ...rest
  } = source;
  void _id; void _name; void _kind; void _sort; void _active; void _c; void _u; void _cb; void _ub;

  const [created] = await db
    .insert(bpScenarios)
    .values({
      ...rest,
      name: trimmed,
      kind: "custom",
      sort: Math.max(...scenarios.map((s) => s.sort)) + 1,
      isActive: false,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: bpScenarios.id });

  const [plan] = await db.select({ dealId: businessPlans.dealId }).from(businessPlans).where(eq(businessPlans.id, businessPlanId));
  if (plan) revalidateDeal(plan.dealId);
  return { ok: true, id: created!.id };
}

export async function renameScenario(scenarioId: string, name: string): Promise<Result> {
  const user = await requireUser();
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: "Nome demasiado curto." };
  const link = await planOfScenario(user.organizationId, scenarioId);
  if (!link) return { ok: false, error: "Cenário não encontrado." };
  await db.update(bpScenarios).set({ name: trimmed, updatedBy: user.id }).where(eq(bpScenarios.id, scenarioId));
  revalidateDeal(link.dealId);
  return { ok: true };
}

/** Apaga um cenário que não seja o ativo nem o último. */
export async function deleteScenario(scenarioId: string): Promise<Result> {
  const user = await requireUser();
  const link = await planOfScenario(user.organizationId, scenarioId);
  if (!link) return { ok: false, error: "Cenário não encontrado." };
  if (link.isActive) return { ok: false, error: "Escolhe outro cenário como ativo antes de apagar este." };
  const scenarios = await listScenarios(user.organizationId, link.planId);
  if (scenarios.length <= 1) return { ok: false, error: "O Business Plan precisa de pelo menos um cenário." };
  await db.delete(bpScenarios).where(eq(bpScenarios.id, scenarioId));
  revalidateDeal(link.dealId);
  return { ok: true };
}

/** Copia um valor calculado (preço máximo) para a ficha do negócio. */
export async function applyMaxPriceToDeal(dealId: string, value: number): Promise<Result> {
  const user = await requireUser();
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "Valor inválido." };
  await db
    .update(deals)
    .set({ maxPrice: value.toFixed(2), updatedBy: user.id })
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, user.organizationId)));
  revalidateDeal(dealId);
  return { ok: true };
}
