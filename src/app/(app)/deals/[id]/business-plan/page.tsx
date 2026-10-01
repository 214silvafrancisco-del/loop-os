import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { organizations } from "@/core/db/schema/core";
import { ScenarioBoard } from "@/modules/business-plan/components/scenario-board";
import { scenarioRowToInputs } from "@/modules/business-plan/mapper";
import { getImtContext } from "@/modules/business-plan/queries";
import { ensureBusinessPlan, getDealContext, propertyContextOf } from "@/modules/business-plan/service";

export default async function DealBusinessPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;

  const dealCtx = await getDealContext(orgId, id);
  if (!dealCtx) notFound();

  const [{ plan, scenarios }, { ctx, year }, [org]] = await Promise.all([
    ensureBusinessPlan(user, id),
    getImtContext(orgId),
    db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, orgId)),
  ]);
  const property = propertyContextOf(dealCtx);
  // Critério de validação: retorno anualizado ≥ alvo (30 % por defeito).
  const targetReturn = org?.settings.targetAnnualizedPct ?? org?.settings.targetRoePct ?? 0.3;

  return (
    <ScenarioBoard
      businessPlanId={plan.id}
      dealId={id}
      scenarios={scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        isActive: s.isActive,
        inputs: scenarioRowToInputs(s, property),
      }))}
      ctx={ctx}
      targetReturn={targetReturn}
      imtYear={year}
    />
  );
}
