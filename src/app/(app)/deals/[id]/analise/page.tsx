import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { organizations } from "@/core/db/schema/core";
import { ComparablesPanel } from "@/modules/business-plan/components/comparables-panel";
import { listComparables } from "@/modules/business-plan/queries";
import { ensureBusinessPlan, getDealContext } from "@/modules/business-plan/service";
import { properties } from "@/modules/properties/schema";

const num = (v: string | null) => (v === null ? null : Number(v));

export default async function DealAnalisePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;

  const dealCtx = await getDealContext(orgId, id);
  if (!dealCtx) notFound();

  const [{ plan, scenarios }, [org], [property]] = await Promise.all([
    ensureBusinessPlan(user, id),
    db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, orgId)),
    db
      .select({ constructionYear: properties.constructionYear, floor: properties.floor, hasElevator: properties.hasElevator })
      .from(properties)
      .where(eq(properties.id, dealCtx.propertyId)),
  ]);
  const comparables = await listComparables(orgId, plan.id);
  const areaAdjPctPerM2 = org?.settings.comparableAreaAdjPctPerM2 ?? 0.0025;

  return (
    <ComparablesPanel
      businessPlanId={plan.id}
      propertyId={dealCtx.propertyId}
      base={{
        area: Number(dealCtx.grossArea ?? 0),
        year: property?.constructionYear ?? null,
        floor: property?.floor ?? null,
        hasElevator: property?.hasElevator ?? null,
      }}
      areaAdjPctPerM2={areaAdjPctPerM2}
      initialRows={comparables.map((c) => ({
        id: c.id,
        label: c.label,
        sourceUrl: c.sourceUrl,
        price: Number(c.price),
        area: Number(c.area),
        floor: c.floor,
        hasElevator: c.hasElevator,
        condition: c.condition,
        adjNegotiation: Number(c.adjNegotiation),
        adjArea: Number(c.adjArea),
        adjLocation: Number(c.adjLocation),
        adjAge: Number(c.adjAge),
        adjCondition: Number(c.adjCondition),
        adjOther: Number(c.adjOther),
        notes: c.notes,
        isIncluded: c.isIncluded,
      }))}
      initialRefs={{
        referenceM2Idealista: num(plan.referenceM2Idealista),
        referenceM2Maxwork: num(plan.referenceM2Maxwork),
        referenceM2Consultant: num(plan.referenceM2Consultant),
      }}
      scenarios={scenarios.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive, salePrice: Number(s.salePrice ?? 0) }))}
    />
  );
}
