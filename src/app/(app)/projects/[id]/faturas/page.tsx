import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { formatMoney } from "@/core/lib/format";
import { listSupplierOptions } from "@/modules/projects/budget/queries";
import { InvoicesPanel } from "@/modules/projects/components/invoices-panel";
import { getProjectFinancials, listInvoices, listPayments } from "@/modules/projects/invoices/queries";
import { monthLabel } from "@/modules/projects/measurements/calc";
import { listMeasurements } from "@/modules/projects/measurements/queries";
import { getProject } from "@/modules/projects/queries";
import { documentCategories } from "@/modules/settings/schema";

export default async function ProjectFaturasPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const project = await getProject(orgId, id);
  if (!project) notFound();

  const [invoices, fin, suppliers, measurements, [category]] = await Promise.all([
    listInvoices(orgId, id),
    getProjectFinancials(orgId, id),
    listSupplierOptions(orgId),
    listMeasurements(orgId, id),
    db
      .select({ id: documentCategories.id })
      .from(documentCategories)
      .where(and(eq(documentCategories.organizationId, orgId), eq(documentCategories.group, "financeiro"), eq(documentCategories.name, "Fatura")))
      .limit(1),
  ]);
  const paymentsByInvoice = Object.fromEntries(await Promise.all(invoices.map(async (i) => [i.id, await listPayments(i.id)] as const)));

  return (
    <InvoicesPanel
      projectId={id}
      propertyId={project.propertyId}
      invoices={invoices}
      paymentsByInvoice={paymentsByInvoice}
      fin={fin}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.isSupplier ? s.name : `${s.name} (contacto)` }))}
      measurements={measurements
        .filter((m) => m.status === "closed")
        .map((m) => ({ id: m.id, number: m.number, label: `Auto n.º ${m.number} · ${monthLabel(m.periodMonth)} · ${formatMoney(m.totalPeriod)}`, total: Number(m.totalPeriod) }))}
      invoiceCategoryId={category?.id ?? null}
      canDelete={user.role !== "user"}
    />
  );
}
