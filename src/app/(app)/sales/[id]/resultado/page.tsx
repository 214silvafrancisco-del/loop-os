import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { PnlTable } from "@/modules/sales/components/pnl-table";
import { RealCostsForm } from "@/modules/sales/components/real-costs-form";
import { monthsBetween } from "@/modules/sales/pnl";
import { getSalePnl } from "@/modules/sales/pnl-queries";
import { getSale } from "@/modules/sales/queries";

/** Resultado do imóvel: Business Plan ativo vs real. */
export default async function SaleResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sale = await getSale(user.organizationId, id);
  if (!sale) notFound();
  const pnl = await getSalePnl(user.organizationId, sale);
  return (
    <div className="flex flex-col gap-5">
      <PnlTable pnl={pnl} />
      <RealCostsForm
        saleId={sale.id}
        hasDeal={pnl.hasDeal}
        values={{ acquisitionCosts: pnl.inputs.acquisitionCosts, holdingCosts: pnl.inputs.holdingCosts, financingCosts: pnl.inputs.financingCosts, otherSaleCosts: pnl.inputs.otherSaleCosts, durationMonths: pnl.inputs.monthsOverride }}
        computedMonths={monthsBetween(pnl.inputs.purchaseDate, pnl.inputs.saleDate ?? pnl.inputs.today)}
      />
    </div>
  );
}
