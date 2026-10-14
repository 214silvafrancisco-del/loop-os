import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { todayIso } from "@/modules/deals/utils";
import { AddWeekForm } from "@/modules/funnel/components/add-week-form";
import { ForecastPanel } from "@/modules/funnel/components/forecast-panel";
import { FunnelTable } from "@/modules/funnel/components/funnel-table";
import { getFunnelForecast, listAllFunnelWeeks } from "@/modules/funnel/queries";

export const metadata: Metadata = { title: "Funil comercial" };

/** Histórico completo do funil semanal, editável, e a previsão derivada. */
export default async function FunnelPage() {
  const user = await requireUser("funil");
  const isAdmin = user.role === "admin";
  const today = todayIso();
  const [rows, forecast] = await Promise.all([listAllFunnelWeeks(user.organizationId, today), getFunnelForecast(user.organizationId, today)]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Funil comercial"
        description={isAdmin ? "Todas as semanas registadas. Edita diretamente nas células; a previsão recalcula-se a cada gravação." : "Todas as semanas registadas pelo admin e a previsão derivada."}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Voltar ao dashboard</Link>
          </Button>
        }
      />
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Previsão de compras</h2>
        <ForecastPanel f={forecast} />
      </section>
      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Histórico ({rows.length} semanas)</h2>
          {isAdmin ? <AddWeekForm existing={rows.map((r) => r.weekStart)} /> : null}
        </div>
        <FunnelTable rows={rows} readOnly={!isAdmin} />
      </section>
    </div>
  );
}
