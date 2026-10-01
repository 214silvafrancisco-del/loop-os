import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { listContacts } from "@/modules/contacts/queries";
import { updateSale } from "@/modules/sales/actions";
import { AgenciesPanel } from "@/modules/sales/components/agencies-panel";
import { SaleForm } from "@/modules/sales/components/sale-form";
import { getSale, listSaleAgencies } from "@/modules/sales/queries";
import { listUsers } from "@/modules/settings/queries";

export default async function SaleResumoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const [sale, agencies, users, contacts] = await Promise.all([getSale(orgId, id), listSaleAgencies(orgId, id), listUsers(orgId), listContacts(orgId, { limit: 500 })]);
  if (!sale) notFound();
  const contactOptions = contacts.map((c) => ({ value: c.id, label: c.companyName ? `${c.name} · ${c.companyName}` : c.name }));
  // Mediadoras primeiro: consultores e empresas.
  const agencyOptions = [...contacts]
    .sort((a, b) => Number(b.roles.includes("consultor") || b.kind === "company") - Number(a.roles.includes("consultor") || a.kind === "company") || a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.companyName ? `${c.name} · ${c.companyName}` : c.name }));

  return (
    <div className="flex flex-col gap-5">
      <AgenciesPanel saleId={sale.id} agencies={agencies} contacts={agencyOptions} referencePrice={sale.salePrice ?? sale.listingPrice} />
      <SaleForm action={updateSale.bind(null, sale.id)} sale={sale} users={users.map((u) => ({ value: u.id, label: u.fullName }))} contacts={contactOptions} cancelHref="/sales" />
    </div>
  );
}
