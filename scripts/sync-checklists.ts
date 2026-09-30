/**
 * Cria/sincroniza as checklists de processo (docs/06) para os negócios ativos
 * e para todas as obras. Idempotente: pode correr sempre que se quiser.
 *
 *   pnpm checklists:sync            negócios ativos + obras
 *   pnpm checklists:sync --all      inclui negócios excluídos
 *   pnpm checklists:sync --deal <id> | --project <id>
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../src/core/db/client";
import * as schema from "../src/core/db/schema";
import { getChecklistView } from "../src/modules/checklists/queries";
import { ensureChecklistSetup } from "../src/modules/checklists/setup";
import { syncChecklist } from "../src/modules/checklists/sync";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? true) : undefined;
};

async function main() {
  const orgs = await db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations);
  for (const org of orgs) {
    const setup = await ensureChecklistSetup(org.id);
    console.log(`\n${org.name}: templates ${setup.createdTemplates.length ? "criados " + setup.createdTemplates.join(", ") : "já existiam"}`);

    const onlyDeal = flag("--deal");
    const onlyProject = flag("--project");

    let dealIds: string[] = [];
    if (typeof onlyDeal === "string") dealIds = [onlyDeal];
    else if (!onlyProject) {
      const where = flag("--all")
        ? and(eq(schema.deals.organizationId, org.id), isNull(schema.deals.deletedAt))
        : and(eq(schema.deals.organizationId, org.id), isNull(schema.deals.deletedAt), eq(schema.deals.status, "active"));
      dealIds = (await db.select({ id: schema.deals.id }).from(schema.deals).where(where)).map((d) => d.id);
    }

    let projectIds: string[] = [];
    if (typeof onlyProject === "string") projectIds = [onlyProject];
    else if (!onlyDeal) {
      projectIds = (
        await db.select({ id: schema.projects.id }).from(schema.projects).where(and(eq(schema.projects.organizationId, org.id), isNull(schema.projects.deletedAt)))
      ).map((p) => p.id);
    }

    for (const [type, ids] of [["deal", dealIds], ["project", projectIds]] as const) {
      let changed = 0;
      for (const id of ids) {
        const r = await syncChecklist(org.id, type, id, null);
        if (!r) continue;
        changed += r.changed;
        const view = await getChecklistView(org.id, type, id);
        const next = view?.nextStep ? ` → próximo: ${view.nextStep.label}` : "";
        console.log(`  ${type} ${id.slice(0, 8)}  ${r.done}/${r.total}${next}`);
      }
      console.log(`✓ ${type}: ${ids.length} sincronizado(s), ${changed} item(ns) alterado(s)`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
