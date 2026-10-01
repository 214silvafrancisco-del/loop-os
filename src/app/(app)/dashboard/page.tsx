import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, Handshake, ListChecks, Tag } from "lucide-react";
import { listDealsRequiredMissing, listProjectAlerts } from "@/modules/checklists/queries";
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
import { formatMoney, formatPercent } from "@/core/lib/format";
import { listActiveProjectFinancials, listUnpaidInvoices } from "@/modules/projects/invoices/queries";
import { PROJECT_STATUS_LABEL } from "@/modules/projects/validation";
import { listDealStages } from "@/modules/settings/queries";
import { SaleStageBadge } from "@/modules/sales/components/sale-badges";
import { daysOnMarket } from "@/modules/sales/constants";
import { listSoldSummary } from "@/modules/sales/pnl-queries";
import { listSales } from "@/modules/sales/queries";

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

function Kpi({ label, value, hint, icon: Icon, href, className }: { label: string; value: string; hint?: string; icon: typeof Handshake; href?: string; className?: string }) {
  const body = (
    <Card className="h-full gap-0 py-0 transition-colors hover:bg-accent/40">
      <CardContent className="flex items-start justify-between gap-2 px-4 py-4 sm:gap-3 sm:py-6">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="line-clamp-2 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-5 sm:size-4" />
        </span>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const orgId = user.organizationId;
  const today = todayIso();
  const weekEnd = endOfWeek(today);
  const sixMonths = addDays(today, 182);

  const [stages, counts, actions, withoutAction, purchases, imtAlerts, activeProjects, unpaidInvoices, requiredMissing, projectAlerts, openSales, sold] = await Promise.all([
    listDealStages(orgId),
    countDealsByStage(orgId),
    listUpcomingActions(orgId, weekEnd),
    countDealsWithoutAction(orgId),
    sumPurchases(orgId),
    listImtDeadlines(orgId, sixMonths),
    listActiveProjectFinancials(orgId),
    listUnpaidInvoices(orgId, 8),
    listDealsRequiredMissing(orgId, 8),
    listProjectAlerts(orgId, 8),
    listSales(orgId, { scope: "open" }),
    listSoldSummary(orgId, Number(today.slice(0, 4))),
  ]);
  const onMarket = openSales.filter((s) => s.stage !== "preparacao");
  const onMarketTotal = onMarket.reduce((a, s) => a + Number(s.listingPrice ?? 0), 0);
  const leadsOpen = openSales.reduce((a, s) => a + s.leadsOpen, 0);
  const unpaidTotal = unpaidInvoices.reduce((a, i) => a + i.unpaid, 0);
  const overdueInvoices = unpaidInvoices.filter((i) => i.overdue).length;

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

      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
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
          label="Em venda"
          value={String(onMarket.length)}
          hint={onMarket.length ? `${formatCurrency(onMarketTotal)} anunciados · ${leadsOpen} leads em aberto` : sold.count ? `${sold.count} vendido${sold.count > 1 ? "s" : ""} em ${today.slice(0, 4)}` : "nenhum imóvel no mercado"}
          icon={Tag}
          href="/sales"
        />
        <Kpi
          label="Sem próxima ação"
          value={String(withoutAction)}
          hint="negócios ativos por planear"
          icon={AlertTriangle}
          href="/deals"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="flex flex-col gap-6 lg:col-span-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Próximas ações</h2>
            <ActionsList deals={actions} />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Obras em curso</h2>
            {activeProjects.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Sem obras ativas.</p>
            ) : (
              <>
              {/* Telemóvel: um cartão por obra com os quatro números que interessam. */}
              <ul className="flex flex-col gap-2 md:hidden">
                {activeProjects.map((p) => {
                  const dev = p.fin.invoicedNet - p.fin.budgeted;
                  return (
                    <li key={p.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/projects/${p.id}`} className="min-w-0 truncate font-medium hover:underline">{p.name}</Link>
                        <span className="shrink-0 text-xs text-muted-foreground">{PROJECT_STATUS_LABEL[p.status]}</span>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        <dt className="text-muted-foreground">Orçamentado</dt><dd className="text-right tabular-nums">{formatMoney(p.fin.budgeted)}</dd>
                        <dt className="text-muted-foreground">Executado</dt><dd className="text-right tabular-nums">{formatMoney(p.fin.executed)}{p.fin.budgeted ? <span className="ml-1 text-xs text-muted-foreground">{formatPercent(p.fin.executed / p.fin.budgeted)}</span> : null}</dd>
                        <dt className="text-muted-foreground">Por pagar</dt><dd className={`text-right tabular-nums ${p.fin.overdueCount ? "font-medium text-destructive" : ""}`}>{formatMoney(p.fin.unpaid)}</dd>
                        <dt className="text-muted-foreground">Desvio</dt><dd className={`text-right tabular-nums ${dev > 0 ? "text-destructive" : "text-muted-foreground"}`}>{dev > 0 ? "+" : ""}{formatMoney(dev)}</dd>
                      </dl>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left">Obra</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-right">Orçamentado</th>
                      <th className="px-3 py-2 text-right">Executado</th>
                      <th className="px-3 py-2 text-right">Faturado</th>
                      <th className="px-3 py-2 text-right">Por pagar</th>
                      <th className="px-3 py-2 text-right">Desvio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProjects.map((p) => {
                      const dev = p.fin.invoicedNet - p.fin.budgeted;
                      return (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground">{p.ref}</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{PROJECT_STATUS_LABEL[p.status]}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.fin.budgeted)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(p.fin.executed)}
                            {p.fin.budgeted ? <span className="ml-1 text-xs text-muted-foreground">{formatPercent(p.fin.executed / p.fin.budgeted)}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.fin.invoicedNet)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${p.fin.overdueCount ? "font-medium text-destructive" : ""}`}>{formatMoney(p.fin.unpaid)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${dev > 0 ? "text-destructive" : "text-muted-foreground"}`}>{dev > 0 ? "+" : ""}{formatMoney(dev)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Tag className="size-4 text-primary" /> Vendas
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {openSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem vendas em curso.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {openSales.map((s) => {
                    const days = daysOnMarket(s.listingDate, s.deedDate, today);
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <Link href={`/sales/${s.id}`} className="font-medium hover:underline">
                            {s.dealName ?? s.addressLine}
                          </Link>
                          <span className="ml-2 font-mono text-[11px] text-muted-foreground">{s.ref}</span>
                          <p className="text-xs text-muted-foreground">
                            {s.listingPrice ? `${formatCurrency(s.listingPrice)} · ` : ""}
                            {days !== null ? `${days} dias · ` : ""}
                            {s.leadsOpen} {s.leadsOpen === 1 ? "lead" : "leads"} em aberto
                          </p>
                        </div>
                        <SaleStageBadge stage={s.stage} />
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-1 border-t pt-2 text-xs text-muted-foreground">
                Vendidos em {today.slice(0, 4)}: <span className="font-medium text-foreground">{sold.count}</span>
                {sold.count ? <> · lucro líquido real <span className={`font-medium ${sold.netProfit < 0 ? "text-destructive" : "text-foreground"}`}>{formatCurrency(sold.netProfit)}</span></> : null}
              </p>
            </CardContent>
          </Card>
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
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListChecks className="size-4 text-primary" /> Procedimentos: obrigatórios em falta
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requiredMissing.length === 0 && projectAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Negócios em Proposta/Compra e obras em curso estão com o procedimento em dia.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {requiredMissing.map((d) => (
                    <li key={d.dealId}>
                      <Link href={`/deals/${d.dealId}/processo`} className="flex items-center justify-between gap-2 hover:underline">
                        <span className="truncate">
                          <span className="font-mono text-[11px] text-muted-foreground">{d.ref}</span> {d.name ?? d.addressLine}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{d.stageName} · {d.missing.length}</span>
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{d.missing.join(" · ")}</p>
                    </li>
                  ))}
                  {projectAlerts.map((p) => (
                    <li key={p.projectId}>
                      <Link href={`/projects/${p.projectId}/processo`} className="flex items-center justify-between gap-2 hover:underline">
                        <span className="truncate">
                          <span className="font-mono text-[11px] text-muted-foreground">{p.ref}</span> Obra {p.name}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-warning">{p.alerts.length}</span>
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{p.alerts.join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Faturas por pagar</CardTitle>
            </CardHeader>
            <CardContent>
              {unpaidInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tudo pago.</p>
              ) : (
                <>
                  <p className="mb-2 text-sm">
                    <span className="text-lg font-semibold tabular-nums">{formatMoney(unpaidTotal)}</span>
                    {overdueInvoices ? <span className="ml-2 text-xs font-medium text-destructive">{overdueInvoices} em atraso</span> : null}
                  </p>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {unpaidInvoices.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2">
                        <Link href={`/projects/${i.projectId}/faturas`} className="truncate hover:underline">
                          <span className="font-mono text-[11px] text-muted-foreground">{i.number}</span> {i.supplierName}
                        </Link>
                        <span className={`shrink-0 text-xs tabular-nums ${i.overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                          {formatMoney(i.unpaid)}{i.dueDate ? ` · ${formatDate(i.dueDate)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
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
