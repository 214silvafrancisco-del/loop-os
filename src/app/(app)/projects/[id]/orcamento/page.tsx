import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { getActiveScenarioForDeal } from "@/modules/business-plan/queries";
import { lineToNode, listBudgetCategories, listBudgetLines } from "@/modules/projects/budget/queries";
import { BudgetEditor } from "@/modules/projects/components/budget-editor";
import { SuppliersPanel } from "@/modules/projects/components/suppliers-panel";
import { getProject } from "@/modules/projects/queries";
import { listProjectSuppliers, listReusableSuppliers } from "@/modules/projects/suppliers/queries";

export default async function ProjectOrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const project = await getProject(orgId, id);
  if (!project) notFound();

  const [lines, suppliers, reusable, categories, scenario] = await Promise.all([
    listBudgetLines(orgId, id),
    listProjectSuppliers(orgId, id),
    listReusableSuppliers(orgId, id),
    listBudgetCategories(orgId),
    getActiveScenarioForDeal(orgId, project.dealId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <SuppliersPanel projectId={id} suppliers={suppliers} reusable={reusable} compact />
      <BudgetEditor
        key={`${lines.map((l) => l.id).join(",")}|${suppliers.map((s) => s.id).join(",")}`}
        projectId={id}
        initialNodes={lines.map(lineToNode)}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, controlMode: s.controlMode }))}
        categories={categories}
        defaultVatRate={scenario ? Number(scenario.worksVatPct) : 0.23}
        hasBusinessPlanBudget={Boolean(scenario && Number(scenario.worksBudget) > 0)}
      />
    </div>
  );
}
