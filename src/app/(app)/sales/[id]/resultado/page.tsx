import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { PnlTable } from "@/modules/sales/components/pnl-table";
import { getSalePnl } from "@/modules/sales/pnl-queries";
import { getSale } from "@/modules/sales/queries";

/** Resultado do imóvel: Business Plan ativo vs real. */
export default async function SaleResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sale = await getSale(user.organizationId, id);
  if (!sale) notFound();
  const pnl = await getSalePnl(user.organizationId, sale);
  return <PnlTable pnl={pnl} />;
}
