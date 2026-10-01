import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { dealRef, todayIso } from "@/modules/deals/utils";
import { listUpcomingActions } from "@/modules/deals/queries";
import { invoices } from "@/modules/projects/schema";
import { formatDigest, type DigestData } from "./digest-format";
import { pushSubscriptions } from "./schema";
import { sendToUsers, type SendResult } from "./send";

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// SQL literal: o Drizzle emitia a coluna sem tabela dentro da subconsulta com alias.
const paidSub = sql<string>`coalesce((select sum(p.amount) from payments p where p.invoice_id = invoices.id), 0)::text`;

/** Números do dia para uma organização: próximas ações e faturas por pagar a vencer. */
export async function buildDigest(organizationId: string, today = todayIso()): Promise<DigestData> {
  const weekEnd = addDays(today, 7);
  const [actions, invoiceRows] = await Promise.all([
    listUpcomingActions(organizationId, today),
    db
      .select({ total: invoices.total, dueDate: invoices.dueDate, paid: paidSub })
      .from(invoices)
      .where(and(eq(invoices.organizationId, organizationId), isNull(invoices.deletedAt), sql`${invoices.dueDate} <= ${weekEnd}`)),
  ]);

  // Só ações com data (as sem data aparecem no dashboard, não no resumo).
  const dated = actions.filter((a) => a.nextActionDate);
  const first = dated[0];
  let invoicesDue = 0;
  let invoicesOverdue = 0;
  let invoicesAmount = 0;
  for (const i of invoiceRows) {
    const remaining = Number(i.total) - Number(i.paid);
    if (remaining <= 0.005) continue;
    invoicesDue++;
    invoicesAmount += remaining;
    if (i.dueDate && i.dueDate < today) invoicesOverdue++;
  }
  return {
    actionsDue: dated.length,
    actionsOverdue: dated.filter((a) => a.nextActionDate! < today).length,
    firstAction: first ? `${dealRef(first)} · ${first.nextAction ?? first.name ?? first.addressLine}` : null,
    invoicesDue,
    invoicesOverdue,
    invoicesAmount,
  };
}

export type DigestRunResult = { organizations: number; notified: number; skipped: number } & SendResult;

/**
 * Resumo diário: para cada organização com dispositivos subscritos, calcula os
 * números e envia a todos os utilizadores ativos com subscrição. Chamado pelo
 * cron (`/api/cron/daily-digest`). Idempotente só no sentido em que reenviar
 * repete a notificação: o agendamento deve ser uma vez por dia.
 */
export async function sendDailyDigest(today = todayIso()): Promise<DigestRunResult> {
  const subscribed = await db
    .selectDistinct({ organizationId: pushSubscriptions.organizationId, userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .innerJoin(profiles, eq(profiles.id, pushSubscriptions.userId))
    .where(eq(profiles.isActive, true));

  const byOrg = new Map<string, string[]>();
  for (const s of subscribed) byOrg.set(s.organizationId, [...(byOrg.get(s.organizationId) ?? []), s.userId]);

  const result: DigestRunResult = { organizations: byOrg.size, notified: 0, skipped: 0, sent: 0, failed: 0, removed: 0 };
  for (const [organizationId, userIds] of byOrg) {
    const payload = formatDigest(await buildDigest(organizationId, today));
    if (!payload) {
      result.skipped++;
      continue;
    }
    const r = await sendToUsers(userIds, payload);
    result.notified++;
    result.sent += r.sent;
    result.failed += r.failed;
    result.removed += r.removed;
  }
  return result;
}
