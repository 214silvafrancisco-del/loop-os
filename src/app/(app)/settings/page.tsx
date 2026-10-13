import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, ListChecks, Users } from "lucide-react";
import { PageHeader } from "@/core/ui/page-header";
import { ComingSoon } from "@/core/ui/coming-soon";
import { requireAdmin } from "@/core/auth/current-user";

export const metadata: Metadata = { title: "Definições" };

export default async function SettingsPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Definições" description="Utilizadores e acessos, procedimentos, notificações. Só para o admin." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Link href="/settings/utilizadores" className="flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Users className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 font-medium">
              Utilizadores e acessos <ArrowRight className="size-3.5" />
            </span>
            <span className="block text-xs text-muted-foreground">Matriz de acessos por módulo, desativar utilizadores, reatribuir tarefas.</span>
          </span>
        </Link>
        <Link href="/notificacoes" className="flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Bell className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 font-medium">
              Notificações <ArrowRight className="size-3.5" />
            </span>
            <span className="block text-xs text-muted-foreground">Ativar o resumo diário neste dispositivo (todos os utilizadores).</span>
          </span>
        </Link>
        <Link href="/settings/procedimentos" className="flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <ListChecks className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 font-medium">
              Procedimentos <ArrowRight className="size-3.5" />
            </span>
            <span className="block text-xs text-muted-foreground">Checklists de Novo Negócio e Nova Obra: passos, regras e portas.</span>
          </span>
        </Link>
      </div>
      <ComingSoon step="Phase 2" what="Utilizadores, fases, fontes, categorias e IMT editáveis aqui" />
    </>
  );
}
