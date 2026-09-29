import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, Handshake } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { PageHeader } from "@/core/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionsList } from "@/modules/dashboard/components/actions-list";
import {
  countDealsByStage,
  countDealsWithoutAction,
  listImtDeadlines,
  listUpcomingActions,
  sumPurchases,
} from "@/modules/deals/queries";
import { dealRef, isOverdue, todayIso } from "@/modules/deals/utils";
import { listDealStages } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Dashboard" };

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Domingo desta semana (segunda a domingo). */
function endOfWeek(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const dow = d.getDay(); // 0 = domingo
  return addDays(iso, dow === 0 ? 0 : 7 - dow);
}

function Kpi({ label, value, hint, icon: Icon, href }: { label: string; value: string; hint?: string; icon: typeof Handshake; href?: string }) {
  const body = (
    <Card className="h-full transition-colors hover:bg-accent/40">
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const orgId = user.organizationId;
  const today = todayIso();
  const weekEnd = endOfWeek(today);
  const sixMonths = addDays(today, 182);

  const [stages, counts, actions, withoutAction, purchases, imtAlerts] = await Promise.all([
    listDealStages(orgId),
    countDealsByStage(orgId),
    listUpcomingActions(orgId, weekEnd),
    countDealsWithoutAction(orgId),
    sumPurchases(orgId),
    listImtDeadlines(orgId, sixMonths),
  ]);

  const countByStage = new Map(counts.map((c) => [c.stageId, c]));
  const purchaseStage = stages.find((s) => s.isPurchase);
  const pipelineStages = stages.filter((s) => !s.isPurchase);
  const pipelineCount = pipelineStages.reduce((acc, s) => acc + (countByStage.get(s.id)?.count ?? 0), 0);
  const pipelineTotal = pipelineStages.reduce((acc, s) => acc + Number(countByStage.get(s.id)?.askingTotal ?? 0), 0);
  const overdueCount = actions.filter((d) => isOverdue(d.nextActionDate)).length;
  const maxCount = Math.max(1, ...pipelineStages.map((s) => countByStage.get(s.id)?.count ?? 0));

  return (
    <>
      <PageHeader title="Dashboard" description={`Semana até ${formatDate(weekEnd)}.`} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Ações da semana"
          value={String(actions.length)}
          hint={overdueCount ? `${overdueCount} atrasada${overdueCount > 1 ? "s" : ""}` : "nenhuma atrasada"}
          icon={CalendarClock}
        />
        <Kpi
          label="Pipeline ativo"
          value={String(pipelineCount)}
          hint={`${formatCurrency(pipelineTotal)} em preço pedido`}
          icon={Handshake}
          href="/deals"
        />
        <Kpi
          label="Comprados"
          value={String(purchases.count)}
          hint={`${formatCurrency(purchases.total)} investidos`}
          icon={Building2}
          href={purchaseStage ? `/deals?stage=${purchaseStage.id}` : "/properties?status=owned"}
        />
        <Kpi
          label="Sem próxima ação"
          value={String(withoutAction)}
          hint="negócios ativos por planear"
          icon={AlertTriangle}
          href="/deals"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Próximas ações</h2>
          <ActionsList deals={actions} />
        </section>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pipeline por fase</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {stages.map((s) => {
                const c = countByStage.get(s.id);
                const n = c?.count ?? 0;
                return (
                  <Link key={s.id} href={`/deals?stage=${s.id}`} className="group text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: s.color ?? "currentColor" }} />
                        {s.name}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {n}
                        {n ? <span className="hidden sm:inline"> · {formatCurrency(c?.askingTotal)}</span> : null}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full transition-all group-hover:opacity-80"
                        style={{ width: `${s.isPurchase ? Math.min(100, (n / maxCount) * 100) : (n / maxCount) * 100}%`, backgroundColor: s.color ?? "var(--primary)" }}
                      />
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Isenção de IMT a expirar</CardTitle>
            </CardHeader>
            <CardContent>
              {imtAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum prazo nos próximos 6 meses.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {imtAlerts.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <Link href={`/deals/${d.id}`} className="truncate hover:underline">
                        <span className="font-mono text-[11px] text-muted-foreground">{dealRef(d)}</span> {d.name ?? d.addressLine}
                      </Link>
                      <span className="shrink-0 text-xs font-medium text-warning">{formatDate(d.imtResaleDeadline)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
