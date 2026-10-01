import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileText, Handshake, ShoppingCart, Sparkles, Tag } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { formatCurrency, formatDate, formatMoney, formatPercent } from "@/core/lib/format";
import { PageHeader } from "@/core/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ActionsList } from "@/modules/dashboard/components/actions-list";
import { getWeekStats } from "@/modules/dashboard/queries";
import { countDealsByStage, listUpcomingActions, sumPurchases } from "@/modules/deals/queries";
import { todayIso } from "@/modules/deals/utils";
import { listActiveProjectFinancials, listUnpaidInvoices } from "@/modules/projects/invoices/queries";
import { PROJECT_STATUS_LABEL } from "@/modules/projects/validation";
import { SaleStageBadge } from "@/modules/sales/components/sale-badges";
import { daysOnMarket } from "@/modules/sales/constants";
import { listSoldSummary } from "@/modules/sales/pnl-queries";
import { listSales } from "@/modules/sales/queries";
import { listDealStages } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Dashboard" };

// Aritmética de datas em UTC: com hora local, toISOString() recuava um dia em Lisboa.
function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira desta semana. */
function startOfWeek(iso: string) {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = domingo
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

type KpiProps = { label: string; value: string; hint?: string; icon: typeof Handshake; href?: string; className?: string; tone?: "primary" | "muted"; /** Três por linha no telemóvel: sem ícone nem legenda abaixo de sm. */ compact?: boolean };

function Kpi({ label, value, hint, icon: Icon, href, className, tone = "primary", compact }: KpiProps) {
  const body = (
    <Card className="h-full gap-0 py-0 transition-colors hover:bg-accent/40">
      <CardContent className="flex items-start justify-between gap-2 px-4 py-4 sm:gap-3 sm:py-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className={cn("line-clamp-2 text-xs text-muted-foreground", compact && "hidden sm:block")}>{hint}</p> : null}
        </div>
        <span className={cn("shrink-0 rounded-lg p-2", compact && "hidden sm:block", tone === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
          <Icon className="size-5 sm:size-4" />
        </span>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const orgId = user.organizationId;
  const today = todayIso();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const stages = await listDealStages(orgId);
  const purchaseStage = stages.find((s) => s.isPurchase) ?? null;

  const [week, counts, actions, purchases, activeProjects, unpaidInvoices, openSales, sold] = await Promise.all([
    getWeekStats(orgId, weekStart, purchaseStage?.id ?? null),
    countDealsByStage(orgId),
    listUpcomingActions(orgId, weekEnd),
    sumPurchases(orgId),
    listActiveProjectFinancials(orgId),
    listUnpaidInvoices(orgId, 8),
    listSales(orgId, { scope: "open" }),
    listSoldSummary(orgId, Number(today.slice(0, 4))),
  ]);
  const countByStage = new Map(counts.map((c) => [c.stageId, c]));
  const openStages = stages.filter((s) => !s.isPurchase);
  const unpaidTotal = unpaidInvoices.reduce((a, i) => a + i.unpaid, 0);
  const overdueInvoices = unpaidInvoices.filter((i) => i.overdue).length;

  return (
    <>
      <PageHeader title="Dashboard" description={`Semana de ${formatDate(weekStart)} a ${formatDate(weekEnd)}.`} />

      <h2 className="mb-2 text-sm font-semibold">Esta semana</h2>
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        <Kpi label="Leads novas" value={String(week.newLeads)} hint="negócios entrados" icon={Sparkles} href="/deals?view=list" compact />
        <Kpi label="Propostas feitas" value={String(week.proposals)} hint="geradas esta semana" icon={FileText} href="/deals?view=list" compact />
        <Kpi label="Compras feitas" value={String(week.purchases)} hint="passaram a Compra" icon={ShoppingCart} href={purchaseStage ? `/deals?stage=${purchaseStage.id}` : "/deals"} compact />
      </div>

      <h2 className="mb-2 text-sm font-semibold">Em aberto</h2>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {openStages.map((s) => {
          const c = countByStage.get(s.id);
          return (
            <Kpi
              key={s.id}
              label={s.name}
              value={String(c?.count ?? 0)}
              hint={c?.count ? `${formatCurrency(c.askingTotal)} em preço pedido` : "nenhum"}
              icon={Handshake}
              href={`/deals?stage=${s.id}`}
              tone="muted"
            />
          );
        })}
        <Kpi
          label={purchaseStage?.name ?? "Compras"}
          value={String(purchases.count)}
          hint={`${formatCurrency(purchases.total)} investidos`}
          icon={Building2}
          href={purchaseStage ? `/deals?stage=${purchaseStage.id}` : "/properties?status=owned"}
          className={openStages.length % 2 === 0 ? "col-span-2 xl:col-span-1" : undefined}
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
                          <Link href={`/projects/${p.id}`} className="min-w-0 truncate font-medium hover:underline">
                            {p.name}
                          </Link>
                          <span className="shrink-0 text-xs text-muted-foreground">{PROJECT_STATUS_LABEL[p.status]}</span>
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                          <dt className="text-muted-foreground">Orçamentado</dt>
                          <dd className="text-right tabular-nums">{formatMoney(p.fin.budgeted)}</dd>
                          <dt className="text-muted-foreground">Executado</dt>
                          <dd className="text-right tabular-nums">
                            {formatMoney(p.fin.executed)}
                            {p.fin.budgeted ? <span className="ml-1 text-xs text-muted-foreground">{formatPercent(p.fin.executed / p.fin.budgeted)}</span> : null}
                          </dd>
                          <dt className="text-muted-foreground">Por pagar</dt>
                          <dd className={`text-right tabular-nums ${p.fin.overdueCount ? "font-medium text-destructive" : ""}`}>{formatMoney(p.fin.unpaid)}</dd>
                          <dt className="text-muted-foreground">Desvio</dt>
                          <dd className={`text-right tabular-nums ${dev > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {dev > 0 ? "+" : ""}
                            {formatMoney(dev)}
                          </dd>
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
                              <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                                {p.name}
                              </Link>
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
                            <td className={`px-3 py-2 text-right tabular-nums ${dev > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {dev > 0 ? "+" : ""}
                              {formatMoney(dev)}
                            </td>
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
                {sold.count ? (
                  <>
                    {" "}
                    · lucro líquido real <span className={`font-medium ${sold.netProfit < 0 ? "text-destructive" : "text-foreground"}`}>{formatCurrency(sold.netProfit)}</span>
                  </>
                ) : null}
              </p>
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
                          {formatMoney(i.unpaid)}
                          {i.dueDate ? ` · ${formatDate(i.dueDate)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
