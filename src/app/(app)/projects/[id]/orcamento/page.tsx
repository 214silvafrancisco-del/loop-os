import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { getActiveScenarioForDeal } from "@/modules/business-plan/queries";
import { lineToNode, listBudgetCategories, listBudgetLines, listSupplierOptions } from "@/modules/projects/budget/queries";
import { BudgetEditor } from "@/modules/projects/components/budget-editor";
import { getProject } from "@/modules/projects/queries";

export default async function ProjectOrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const project = await getProject(orgId, id);
  if (!project) notFound();

  const [lines, suppliers, categories, scenario] = await Promise.all([
    listBudgetLines(orgId, id),
    listSupplierOptions(orgId),
    listBudgetCategories(orgId),
    getActiveScenarioForDeal(orgId, project.dealId),
  ]);

  return (
    <BudgetEditor
      key={lines.map((l) => l.id).join(",")}
      projectId={id}
      initialNodes={lines.map(lineToNode)}
      suppliers={suppliers}
      categories={categories}
      defaultVatRate={scenario ? Number(scenario.worksVatPct) : 0.23}
      hasBusinessPlanBudget={Boolean(scenario && Number(scenario.worksBudget) > 0)}
    />
  );
}
