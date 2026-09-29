import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { DealHeader } from "@/modules/deals/components/deal-header";
import { DealTabs } from "@/modules/deals/components/deal-tabs";
import { countDealNotes } from "@/modules/deals/notes-queries";
import { getDeal, getDealRow } from "@/modules/deals/queries";
import { dealRef } from "@/modules/deals/utils";
import { getProjectForDeal } from "@/modules/projects/queries";
import { listDealStages } from "@/modules/settings/queries";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requireUser();
  const row = await getDealRow(user.organizationId, (await params).id);
  return { title: row ? `${dealRef(row)} · ${row.name ?? row.addressLine}` : "Negócio" };
}

/** Cabeçalho e tabs comuns a todas as páginas do negócio. */
export default async function DealLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const [deal, row, stages, notesCount, project] = await Promise.all([
    getDeal(orgId, id),
    getDealRow(orgId, id),
    listDealStages(orgId, false),
    countDealNotes(orgId, id),
    getProjectForDeal(orgId, id),
  ]);
  if (!deal || !row) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <DealHeader deal={deal} row={row} stages={stages} project={project} />
      <DealTabs dealId={deal.id} counts={{ notas: notesCount }} />
      {children}
    </div>
  );
}
