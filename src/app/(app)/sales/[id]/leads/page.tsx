import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { listContacts } from "@/modules/contacts/queries";
import { LeadsPanel } from "@/modules/sales/components/leads-panel";
import { getSale, listSaleAgencies, listSaleLeads } from "@/modules/sales/queries";

export default async function SaleLeadsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const [sale, leads, agencies, contacts] = await Promise.all([getSale(orgId, id), listSaleLeads(orgId, id), listSaleAgencies(orgId, id), listContacts(orgId, { limit: 500 })]);
  if (!sale) notFound();
  return (
    <LeadsPanel
      saleId={sale.id}
      leads={leads}
      agencies={agencies.map((a) => ({ value: a.id, label: a.contactName }))}
      contacts={contacts.map((c) => ({ value: c.id, label: c.companyName ? `${c.name} · ${c.companyName}` : c.name }))}
    />
  );
}
