import { notFound } from "next/navigation";
import { listAuditForProperty } from "@/core/audit/queries";
import { AuditTimeline } from "@/core/audit/audit-timeline";
import { requireUser } from "@/core/auth/current-user";
import { listContacts } from "@/modules/contacts/queries";
import { getDeal } from "@/modules/deals/queries";
import { listDealStages, listSourceChannels, listUsers } from "@/modules/settings/queries";

/** Tudo o que aconteceu ao imóvel deste negócio: negócios, notas, alterações ao imóvel. */
export default async function DealHistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const orgId = user.organizationId;
  const deal = await getDeal(orgId, id);
  if (!deal) notFound();

  const [entries, stages, users, sources, contacts] = await Promise.all([
    listAuditForProperty(orgId, deal.propertyId),
    listDealStages(orgId, false),
    listUsers(orgId),
    listSourceChannels(orgId),
    listContacts(orgId, { limit: 1000 }),
  ]);

  const toMap = <T extends { id: string }>(rows: T[], pick: (r: T) => string) =>
    Object.fromEntries(rows.map((r) => [r.id, pick(r)]));

  return (
    <div className="mx-auto max-w-3xl">
      <AuditTimeline
        entries={entries}
        lookups={{
          stages: toMap(stages, (s) => s.name),
          users: toMap(users, (u) => u.fullName),
          sources: toMap(sources, (s) => s.name),
          contacts: toMap(contacts, (c) => c.name),
        }}
      />
    </div>
  );
}
