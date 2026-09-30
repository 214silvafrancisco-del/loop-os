import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { loadDealContext, loadProjectContext } from "./context";
import { nextItemState, sameState, summarize, type ItemState } from "./engine";
import type { RuleContext } from "./rules";
import { checklistItems, checklistTemplateItems, checklistTemplates, checklists, type ChecklistEntityType } from "./schema";
import { ensureChecklistSetup } from "./setup";

/**
 * Sincroniza a checklist de um negócio/obra com os dados reais:
 * cria a instância a partir do template ativo se ainda não existir,
 * reavalia os itens automáticos e as condições de contexto, grava só o que
 * mudou e atualiza os contadores. Idempotente; `userId` fica como autor dos
 * itens que ficam concluídos nesta passagem.
 */
export async function syncChecklist(
  organizationId: string,
  entityType: ChecklistEntityType,
  entityId: string,
  userId: string | null,
): Promise<{ checklistId: string; done: number; total: number; changed: number } | null> {
  let rc: RuleContext;
  let entity: { propertyId: string; ownerUserId?: string | null; managerUserId?: string | null };
  if (entityType === "deal") {
    const loaded = await loadDealContext(organizationId, entityId);
    if (!loaded) return null;
    rc = { entityType: "deal", ctx: loaded.ctx };
    entity = loaded.entity;
  } else {
    const loaded = await loadProjectContext(organizationId, entityId);
    if (!loaded) return null;
    rc = { entityType: "project", ctx: loaded.ctx };
    entity = loaded.entity;
  }

  const checklist = await getOrCreateInstance(organizationId, entityType, entityId, entity, userId);
  if (!checklist) return null;

  const rows = await db
    .select({
      id: checklistItems.id,
      status: checklistItems.status,
      source: checklistItems.source,
      detail: checklistItems.detail,
      completedAt: checklistItems.completedAt,
      completedBy: checklistItems.completedBy,
      kind: checklistItems.kind,
      ruleKey: checklistTemplateItems.ruleKey,
      appliesWhen: checklistTemplateItems.appliesWhen,
    })
    .from(checklistItems)
    .innerJoin(checklistTemplateItems, eq(checklistItems.templateItemId, checklistTemplateItems.id))
    .where(eq(checklistItems.checklistId, checklist.id));

  const now = new Date();
  let changed = 0;
  const statuses: { status: ItemState["status"] }[] = [];
  for (const row of rows) {
    const cur: ItemState = { status: row.status, source: row.source, detail: row.detail, completedAt: row.completedAt, completedBy: row.completedBy };
    const next = nextItemState({ kind: row.kind, ruleKey: row.ruleKey, appliesWhen: row.appliesWhen }, cur, rc, now, userId);
    statuses.push({ status: next.status });
    if (sameState(cur, next)) continue;
    await db
      .update(checklistItems)
      .set({ status: next.status, source: next.source, detail: next.detail, completedAt: next.completedAt, completedBy: next.completedBy, updatedBy: userId })
      .where(eq(checklistItems.id, row.id));
    changed++;
  }

  const s = summarize(statuses);
  await db
    .update(checklists)
    .set({ doneCount: s.done, totalCount: s.total, progress: s.progress.toFixed(4), syncedAt: now })
    .where(eq(checklists.id, checklist.id));

  return { checklistId: checklist.id, done: s.done, total: s.total, changed };
}

async function getOrCreateInstance(
  organizationId: string,
  entityType: ChecklistEntityType,
  entityId: string,
  entity: { propertyId: string; ownerUserId?: string | null; managerUserId?: string | null },
  userId: string | null,
): Promise<{ id: string } | null> {
  const [existing] = await db
    .select({ id: checklists.id })
    .from(checklists)
    .where(and(eq(checklists.entityType, entityType), eq(checklists.entityId, entityId)));
  if (existing) return existing;

  let [template] = await activeTemplate(organizationId, entityType);
  if (!template) {
    await ensureChecklistSetup(organizationId);
    [template] = await activeTemplate(organizationId, entityType);
  }
  if (!template) return null;

  const items = await db.select().from(checklistTemplateItems).where(eq(checklistTemplateItems.templateId, template.id));
  const assigneeFor = (d: string | null) => (d === "owner" ? (entity.ownerUserId ?? null) : d === "manager" ? (entity.managerUserId ?? null) : null);

  return db.transaction(async (tx) => {
    const [c] = await tx
      .insert(checklists)
      .values({
        organizationId,
        templateId: template!.id,
        templateVersion: template!.version,
        entityType,
        entityId,
        propertyId: entity.propertyId,
        totalCount: items.length,
      })
      .onConflictDoNothing()
      .returning({ id: checklists.id });
    if (!c) {
      // Corrida: outra sincronização criou-a entretanto.
      const [again] = await tx.select({ id: checklists.id }).from(checklists).where(and(eq(checklists.entityType, entityType), eq(checklists.entityId, entityId)));
      return again ?? null;
    }
    await tx.insert(checklistItems).values(
      items.map((it) => ({
        checklistId: c.id,
        templateItemId: it.id,
        code: it.code,
        section: it.section,
        sort: it.sort,
        kind: it.kind,
        isRequired: it.isRequired,
        assigneeUserId: assigneeFor(it.defaultAssignee),
        updatedBy: userId,
      })),
    );
    return c;
  });
}

function activeTemplate(organizationId: string, entityType: ChecklistEntityType) {
  return db
    .select({ id: checklistTemplates.id, version: checklistTemplates.version })
    .from(checklistTemplates)
    .where(and(eq(checklistTemplates.organizationId, organizationId), eq(checklistTemplates.entityType, entityType), eq(checklistTemplates.isActive, true)))
    .limit(1);
}
