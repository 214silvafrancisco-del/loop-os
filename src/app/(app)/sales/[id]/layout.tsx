import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { SaleHeader } from "@/modules/sales/components/sale-header";
import { SaleTabs } from "@/modules/sales/components/sale-tabs";
import { getSale, getSaleRow } from "@/modules/sales/queries";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requireUser();
  const row = await getSaleRow(user.organizationId, (await params).id);
  return { title: row ? `Venda ${row.ref} · ${row.dealName ?? row.addressLine}` : "Venda" };
}

/** Cabeçalho e tabs comuns a todas as páginas da venda. */
export default async function SaleLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const [sale, row] = await Promise.all([getSale(user.organizationId, id), getSaleRow(user.organizationId, id)]);
  if (!sale || !row) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <SaleHeader sale={sale} row={row} canDelete={user.role !== "user"} />
      <SaleTabs saleId={sale.id} counts={{ leads: row.leadsOpen }} />
      {children}
    </div>
  );
}
