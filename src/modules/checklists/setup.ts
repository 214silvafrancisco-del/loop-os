import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { documentCategories } from "@/modules/settings/schema";
import { checklistItems, checklistTemplateItems, checklistTemplates, checklists } from "./schema";
import { CHECKLIST_DOCUMENT_CATEGORIES, CHECKLIST_TEMPLATES } from "./templates";

/**
 * Garante que os procedimentos de `templates.ts` existem na base de dados
 * (por código e versão) e que só a versão mais recente está ativa. Idempotente;
 * corre no seed, no script de sincronização e quando uma organização ainda não
 * tem templates. Também cria as categorias de documento que os procedimentos usam.
 */
export async function ensureChecklistSetup(organizationId: string): Promise<{ createdTemplates: string[] }> {
  const created: string[] = [];

  for (const def of CHECKLIST_TEMPLATES) {
    const [existing] = await db
      .select({ id: checklistTemplates.id })
      .from(checklistTemplates)
      .where(and(eq(checklistTemplates.organizationId, organizationId), eq(checklistTemplates.code, def.code), eq(checklistTemplates.version, def.version)));
    if (existing) continue;

    await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(checklistTemplates)
        .values({ organizationId, code: def.code, name: def.name, entityType: def.entityType, version: def.version, isActive: true })
        .returning({ id: checklistTemplates.id });
      await tx.insert(checklistTemplateItems).values(
        def.items.map((it, i) => ({
          templateId: t!.id,
          code: it.code,
          section: it.section,
          label: it.label,
          help: it.help ?? null,
          sort: (i + 1) * 10,
          kind: it.kind,
          ruleKey: it.ruleKey ?? null,
          isRequired: it.required ?? false,
          appliesWhen: it.appliesWhen ?? null,
          dependsOnCode: it.dependsOn ?? null,
          defaultAssignee: it.defaultAssignee ?? null,
          gates: it.gates ?? [],
          linkPath: it.linkPath ?? null,
        })),
      );
      // Só a versão mais recente fica ativa.
      await tx
        .update(checklistTemplates)
        .set({ isActive: false })
        .where(and(eq(checklistTemplates.organizationId, organizationId), eq(checklistTemplates.code, def.code), sql`${checklistTemplates.version} < ${def.version}`));
    });
    created.push(`${def.code} v${def.version}`);
    await upgradeInstances(organizationId, def.code, def.version);
  }

  for (const c of CHECKLIST_DOCUMENT_CATEGORIES) {
    const [max] = await db
      .select({ sort: sql<number>`coalesce(max(${documentCategories.sort}), 0)::int` })
      .from(documentCategories)
      .where(eq(documentCategories.organizationId, organizationId));
    await db
      .insert(documentCategories)
      .values({ organizationId, group: c.group, name: c.name, defaultEntity: c.defaultEntity, sort: (max?.sort ?? 0) + 1 })
      .onConflictDoNothing();
  }

  return { createdTemplates: created };
}

/**
 * Passa as checklists existentes de um procedimento para a versão nova:
 * itens com o mesmo código mantêm o estado e passam a apontar para o item
 * novo (secção, ordem, obrigatoriedade atualizadas); itens que deixaram de
 * existir são apagados; itens novos entram pendentes. Os contadores são
 * refeitos na sincronização seguinte.
 */
export async function upgradeInstances(organizationId: string, code: string, version: number): Promise<number> {
  const [template] = await db
    .select({ id: checklistTemplates.id })
    .from(checklistTemplates)
    .where(and(eq(checklistTemplates.organizationId, organizationId), eq(checklistTemplates.code, code), eq(checklistTemplates.version, version)));
  if (!template) return 0;
  const newItems = await db.select().from(checklistTemplateItems).where(eq(checklistTemplateItems.templateId, template.id));
  const byCode = new Map(newItems.map((i) => [i.code, i]));

  const old = await db
    .select({ id: checklists.id, templateId: checklists.templateId })
    .from(checklists)
    .innerJoin(checklistTemplates, eq(checklists.templateId, checklistTemplates.id))
    .where(and(eq(checklists.organizationId, organizationId), eq(checklistTemplates.code, code), sql`${checklistTemplates.version} < ${version}`));

  for (const c of old) {
    await db.transaction(async (tx) => {
      const items = await tx.select({ id: checklistItems.id, code: checklistItems.code }).from(checklistItems).where(eq(checklistItems.checklistId, c.id));
      const present = new Set<string>();
      for (const it of items) {
        const n = byCode.get(it.code);
        if (!n) {
          await tx.delete(checklistItems).where(eq(checklistItems.id, it.id));
          continue;
        }
        present.add(it.code);
        await tx
          .update(checklistItems)
          .set({ templateItemId: n.id, section: n.section, sort: n.sort, kind: n.kind, isRequired: n.isRequired })
          .where(eq(checklistItems.id, it.id));
      }
      const missing = newItems.filter((n) => !present.has(n.code));
      if (missing.length) {
        await tx.insert(checklistItems).values(
          missing.map((n) => ({ checklistId: c.id, templateItemId: n.id, code: n.code, section: n.section, sort: n.sort, kind: n.kind, isRequired: n.isRequired })),
        );
      }
      await tx.update(checklists).set({ templateId: template.id, templateVersion: version }).where(eq(checklists.id, c.id));
    });
  }
  return old.length;
}
