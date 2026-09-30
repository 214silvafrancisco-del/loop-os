import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { checklistItems, checklistTemplateItems, checklistTemplates, checklists, type ChecklistEntityType, type ChecklistItemStatus } from "./schema";
import { SECTION_LABELS } from "./templates";

export type ChecklistItemView = {
  id: string;
  code: string;
  section: string;
  sort: number;
  label: string;
  help: string | null;
  kind: "auto" | "manual";
  isRequired: boolean;
  status: ChecklistItemStatus;
  source: "auto" | "manual" | "context" | null;
  detail: string | null;
  completedAt: Date | null;
  completedByName: string | null;
  naNote: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  linkPath: string | null;
  gates: string[];
  /** Label do item de que depende e que ainda não está concluído. */
  blockedBy: string | null;
};

export type ChecklistSectionView = { code: string; label: string; done: number; total: number; items: ChecklistItemView[] };

export type ChecklistView = {
  id: string;
  entityType: ChecklistEntityType;
  entityId: string;
  templateName: string;
  templateVersion: number;
  doneCount: number;
  totalCount: number;
  progress: number;
  syncedAt: Date | null;
  sections: ChecklistSectionView[];
  /** Primeiro item pendente e não bloqueado; obrigatórios primeiro. */
  nextStep: ChecklistItemView | null;
};

/** Lê a checklist (sem sincronizar; ver `syncChecklist`). */
export async function getChecklistView(organizationId: string, entityType: ChecklistEntityType, entityId: string): Promise<ChecklistView | null> {
  const [c] = await db
    .select({ checklist: checklists, templateName: checklistTemplates.name })
    .from(checklists)
    .innerJoin(checklistTemplates, eq(checklists.templateId, checklistTemplates.id))
    .where(and(eq(checklists.organizationId, organizationId), eq(checklists.entityType, entityType), eq(checklists.entityId, entityId)));
  if (!c) return null;

  const completedBy = alias(profiles, "completed_by_profile");
  const assignee = alias(profiles, "assignee_profile");
  const rows = await db
    .select({
      item: checklistItems,
      label: checklistTemplateItems.label,
      help: checklistTemplateItems.help,
      linkPath: checklistTemplateItems.linkPath,
      gates: checklistTemplateItems.gates,
      dependsOnCode: checklistTemplateItems.dependsOnCode,
      completedByName: completedBy.fullName,
      assigneeName: assignee.fullName,
    })
    .from(checklistItems)
    .innerJoin(checklistTemplateItems, eq(checklistItems.templateItemId, checklistTemplateItems.id))
    .leftJoin(completedBy, eq(checklistItems.completedBy, completedBy.id))
    .leftJoin(assignee, eq(checklistItems.assigneeUserId, assignee.id))
    .where(eq(checklistItems.checklistId, c.checklist.id))
    .orderBy(checklistItems.sort);

  const byCode = new Map(rows.map((r) => [r.item.code, r]));
  const items: ChecklistItemView[] = rows.map((r) => {
    const dep = r.dependsOnCode ? byCode.get(r.dependsOnCode) : undefined;
    const blocked = dep && dep.item.status === "pending" && r.item.status === "pending";
    return {
      id: r.item.id,
      code: r.item.code,
      section: r.item.section,
      sort: r.item.sort,
      label: r.label,
      help: r.help,
      kind: r.item.kind,
      isRequired: r.item.isRequired,
      status: r.item.status,
      source: r.item.source,
      detail: r.item.detail,
      completedAt: r.item.completedAt,
      completedByName: r.completedByName,
      naNote: r.item.naNote,
      assigneeUserId: r.item.assigneeUserId,
      assigneeName: r.assigneeName,
      linkPath: r.linkPath,
      gates: r.gates,
      blockedBy: blocked ? dep!.label : null,
    };
  });

  const sections: ChecklistSectionView[] = [];
  for (const it of items) {
    let s = sections.find((x) => x.code === it.section);
    if (!s) {
      s = { code: it.section, label: SECTION_LABELS[it.section] ?? it.section, done: 0, total: 0, items: [] };
      sections.push(s);
    }
    s.items.push(it);
    if (it.status !== "not_applicable") {
      s.total++;
      if (it.status === "done") s.done++;
    }
  }

  const candidates = items.filter((i) => i.status === "pending" && !i.blockedBy);
  const nextStep = candidates.find((i) => i.isRequired) ?? candidates[0] ?? null;

  return {
    id: c.checklist.id,
    entityType,
    entityId,
    templateName: c.templateName,
    templateVersion: c.checklist.templateVersion,
    doneCount: c.checklist.doneCount,
    totalCount: c.checklist.totalCount,
    progress: Number(c.checklist.progress),
    syncedAt: c.checklist.syncedAt,
    sections,
    nextStep,
  };
}

export type ChecklistProgress = { done: number; total: number; progress: number };

/** Progresso de várias entidades de uma vez (lista, Kanban). */
export async function getChecklistProgressMap(organizationId: string, entityType: ChecklistEntityType, entityIds: string[]): Promise<Map<string, ChecklistProgress>> {
  const map = new Map<string, ChecklistProgress>();
  if (entityIds.length === 0) return map;
  const rows = await db
    .select({ entityId: checklists.entityId, done: checklists.doneCount, total: checklists.totalCount, progress: checklists.progress })
    .from(checklists)
    .where(and(eq(checklists.organizationId, organizationId), eq(checklists.entityType, entityType), inArray(checklists.entityId, entityIds)));
  for (const r of rows) map.set(r.entityId, { done: r.done, total: r.total, progress: Number(r.progress) });
  return map;
}

export type GateCheck = { hard: ChecklistItemView[]; warn: ChecklistItemView[] };

/**
 * Itens pendentes que condicionam uma porta ("proposal:generate",
 * "deal:stage:compra", "project:em_curso"…). `hard` bloqueia; `warn` avisa.
 */
export async function getGateCheck(organizationId: string, entityType: ChecklistEntityType, entityId: string, gate: string): Promise<GateCheck> {
  const view = await getChecklistView(organizationId, entityType, entityId);
  const out: GateCheck = { hard: [], warn: [] };
  if (!view) return out;
  for (const s of view.sections) {
    for (const it of s.items) {
      if (it.status !== "pending") continue;
      if (it.gates.includes(`hard:${gate}`)) out.hard.push(it);
      else if (it.gates.includes(`warn:${gate}`)) out.warn.push(it);
    }
  }
  return out;
}

/** Entidade e organização de um item (para ações e revalidação). */
export async function getChecklistItemOwner(itemId: string) {
  const [row] = await db
    .select({ organizationId: checklists.organizationId, entityType: checklists.entityType, entityId: checklists.entityId, kind: checklistItems.kind, status: checklistItems.status })
    .from(checklistItems)
    .innerJoin(checklists, eq(checklistItems.checklistId, checklists.id))
    .where(eq(checklistItems.id, itemId));
  return row ?? null;
}
