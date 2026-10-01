import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Columns3, List, Plus } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { formatCurrency } from "@/core/lib/format";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SalesFilters } from "@/modules/sales/components/sales-filters";
import { SalesKanban } from "@/modules/sales/components/sales-kanban";
import { SalesTable } from "@/modules/sales/components/sales-table";
import { SALE_STAGES } from "@/modules/sales/constants";
import { countSalesByStage, listSales } from "@/modules/sales/queries";
import type { SaleStage } from "@/modules/sales/schema";
import { listUsers } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Vendas" };

type Search = { q?: string; stage?: string; scope?: string; owner?: string; view?: string };
const STAGE_VALUES = SALE_STAGES.map((s) => s.value);

export default async function SalesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const cookieStore = await cookies();
  const view = sp.view === "kanban" || sp.view === "list" ? sp.view : cookieStore.get("sales_view")?.value === "list" ? "list" : "kanban";
  const stage = STAGE_VALUES.includes(sp.stage as SaleStage) ? (sp.stage as SaleStage) : undefined;
  const scope = sp.scope === "closed" || sp.scope === "all" ? sp.scope : stage && (stage === "vendido" || stage === "cancelada") ? "all" : "open";

  const [sales, counts, users] = await Promise.all([
    listSales(user.organizationId, { q: sp.q, stage: view === "kanban" ? undefined : stage, scope: view === "kanban" ? "open" : scope, ownerUserId: sp.owner || undefined }),
    countSalesByStage(user.organizationId),
    listUsers(user.organizationId),
  ]);
  const byStage = new Map(counts.map((c) => [c.stage, c]));
  const openTotal = counts.filter((c) => c.stage === "a_venda" || c.stage === "cpcv").reduce((a, c) => a + Number(c.listingTotal), 0);
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "view") as [string, string][]).toString();
  const toggle = (v: "list" | "kanban", Icon: typeof List, label: string) => (
    <Link
      href={`/sales?${query ? `${query}&` : ""}view=${v}`}
      className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors", view === v ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}
      aria-current={view === v ? "page" : undefined}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Vendas"
        description="Pipeline de venda: Preparação → À venda → CPCV → Vendido. Mediadoras, leads e resultado por imóvel."
        actions={
          <>
            <div className="flex rounded-lg bg-muted p-0.5">
              {toggle("list", List, "Lista")}
              {toggle("kanban", Columns3, "Kanban")}
            </div>
            <Button asChild size="sm" className="gap-1">
              <Link href="/sales/new">
                <Plus className="size-4" />
                Nova venda
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {SALE_STAGES.map((s) => {
          const c = byStage.get(s.value);
          const active = stage === s.value;
          return (
            <Link
              key={s.value}
              href={active ? `/sales?view=list` : `/sales?view=list&stage=${s.value}`}
              className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors", active ? "border-primary bg-primary/10" : "bg-card hover:bg-accent")}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums text-muted-foreground">{c?.count ?? 0}</span>
            </Link>
          );
        })}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          No mercado: <span className="font-medium text-foreground">{formatCurrency(openTotal)}</span>
        </span>
      </div>

      <SalesFilters values={{ q: sp.q ?? "", stage: stage ?? "", scope, owner: sp.owner ?? "", view }} users={users.map((u) => ({ value: u.id, label: u.fullName }))} />

      {view === "kanban" ? (
        <SalesKanban sales={sales} />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {sales.length} {sales.length === 1 ? "venda" : "vendas"}
          </p>
          <SalesTable sales={sales} />
        </>
      )}
    </>
  );
}
