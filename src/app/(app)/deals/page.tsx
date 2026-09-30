import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { formatCurrency } from "@/core/lib/format";
import { NativeSelect } from "@/core/ui/form-field";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DealsTable } from "@/modules/deals/components/deals-table";
import { KanbanBoard } from "@/modules/deals/components/kanban-board";
import { ViewToggle, type DealsView } from "@/modules/deals/components/view-toggle";
import { countDealsByStage, listDealFilterOptions, listDeals } from "@/modules/deals/queries";
import { listDealStages, listSourceChannels, listUsers } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Negócios" };

type Search = {
  q?: string;
  stage?: string;
  status?: string;
  municipality?: string;
  typology?: string;
  source?: string;
  owner?: string;
  process?: string;
  view?: string;
};

export default async function DealsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const cookieStore = await cookies();
  const view: DealsView =
    sp.view === "kanban" || sp.view === "list"
      ? sp.view
      : cookieStore.get("deals_view")?.value === "kanban"
        ? "kanban"
        : "list";
  const status = sp.status === "excluded" || sp.status === "all" ? sp.status : "active";

  const [deals, stages, sources, users, options, counts] = await Promise.all([
    listDeals(user.organizationId, {
      q: sp.q,
      stageId: view === "kanban" ? undefined : sp.stage || undefined,
      status: view === "kanban" ? "active" : status,
      municipality: sp.municipality || undefined,
      typology: sp.typology || undefined,
      sourceChannelId: sp.source || undefined,
      ownerUserId: sp.owner || undefined,
      process: sp.process === "required_missing" || sp.process === "complete" ? sp.process : undefined,
    }),
    listDealStages(user.organizationId),
    listSourceChannels(user.organizationId),
    listUsers(user.organizationId),
    listDealFilterOptions(user.organizationId),
    countDealsByStage(user.organizationId),
  ]);

  const countByStage = new Map(counts.map((c) => [c.stageId, c]));
  const pipelineTotal = counts.reduce((acc, c) => acc + Number(c.askingTotal), 0);
  const filterEntries = Object.entries(sp).filter(([k, v]) => v && k !== "view" && k !== "stage");
  const query = new URLSearchParams(filterEntries as [string, string][]).toString();
  const hasFilters = filterEntries.length > 0 || Boolean(sp.stage);

  return (
    <>
      <PageHeader
        title="Negócios"
        description="Pipeline de aquisição: Lead Fria → Lead Morna → Visita → Proposta → Compra."
        actions={
          <>
            <ViewToggle view={view} query={query} />
            <Button asChild size="sm" className="gap-1">
              <Link href="/deals/new">
                <Plus className="size-4" />
                Novo negócio
              </Link>
            </Button>
          </>
        }
      />

      {view === "list" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {stages.map((s) => {
            const c = countByStage.get(s.id);
            const active = sp.stage === s.id;
            return (
              <Link
                key={s.id}
                href={active ? `/deals?${query}` : `/deals?${query}${query ? "&" : ""}stage=${s.id}`}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${active ? "border-primary bg-primary/10" : "bg-card hover:bg-accent"}`}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color ?? "currentColor" }} />
                <span className="font-medium">{s.name}</span>
                <span className="tabular-nums text-muted-foreground">{c?.count ?? 0}</span>
              </Link>
            );
          })}
          <span className="ml-auto self-center text-xs text-muted-foreground">
            Pipeline ativo: <span className="font-medium text-foreground">{formatCurrency(pipelineTotal)}</span>
          </span>
        </div>
      ) : null}

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input type="hidden" name="view" value={view} />
        {sp.stage && view === "list" ? <input type="hidden" name="stage" value={sp.stage} /> : null}
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Morada, freguesia, ref, contacto, próxima ação" className="pl-8" />
        </div>
        {view === "list" ? (
          <NativeSelect name="status" defaultValue={status} className="w-auto">
            <option value="active">Ativos</option>
            <option value="excluded">Excluídos</option>
            <option value="all">Todos</option>
          </NativeSelect>
        ) : null}
        <NativeSelect name="municipality" defaultValue={sp.municipality ?? ""} className="w-auto">
          <option value="">Concelho</option>
          {options.municipalities.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="typology" defaultValue={sp.typology ?? ""} className="w-auto">
          <option value="">Tipologia</option>
          {options.typologies.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="source" defaultValue={sp.source ?? ""} className="w-auto">
          <option value="">Fonte</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="owner" defaultValue={sp.owner ?? ""} className="w-auto">
          <option value="">Responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="process" defaultValue={sp.process ?? ""} className="w-auto">
          <option value="">Processo</option>
          <option value="required_missing">Com obrigatórios em falta</option>
          <option value="complete">Processo completo</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">Filtrar</Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href={`/deals?view=${view}`}>Limpar</Link>
          </Button>
        ) : null}
      </form>

      {view === "kanban" ? (
        <KanbanBoard stages={stages} deals={deals} />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {deals.length} {deals.length === 1 ? "negócio" : "negócios"}
          </p>
          <DealsTable deals={deals} />
        </>
      )}
    </>
  );
}
