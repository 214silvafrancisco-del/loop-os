import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { getActiveScenarioForDeal } from "@/modules/business-plan/queries";
import { checkGate } from "@/modules/checklists/gates";
import { getDeal } from "@/modules/deals/queries";
import { ProposalsPanel } from "@/modules/proposals/components/proposals-panel";
import { listProposals, listTemplates } from "@/modules/proposals/queries";
import { DEFAULT_CONDITIONS } from "@/modules/proposals/snapshot";

export default async function DealPropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const deal = await getDeal(orgId, id);
  if (!deal) notFound();

  const [templates, proposals, scenario, gate] = await Promise.all([
    listTemplates(orgId),
    listProposals(orgId, id),
    getActiveScenarioForDeal(orgId, id),
    checkGate(orgId, "deal", id, "proposal:generate", user.id),
  ]);

  const suggestions = [
    deal.maxPrice ? { label: "Preço máximo", value: Number(deal.maxPrice) } : null,
    deal.targetPrice ? { label: "Preço alvo", value: Number(deal.targetPrice) } : null,
    scenario?.purchasePrice && Number(scenario.purchasePrice) > 0 ? { label: `BP · ${scenario.name}`, value: Number(scenario.purchasePrice) } : null,
    deal.askingPrice ? { label: "Preço pedido", value: Number(deal.askingPrice) } : null,
  ].filter((s): s is { label: string; value: number } => s !== null);

  return (
    <ProposalsPanel
      dealId={id}
      templates={templates}
      proposals={proposals}
      suggestions={suggestions}
      defaultConditions={DEFAULT_CONDITIONS}
      gate={gate}
    />
  );
}
