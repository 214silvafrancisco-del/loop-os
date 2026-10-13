import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { MODULE_LABEL, isAppModule } from "@/core/auth/access";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sem acesso" };

/** Página para quem tenta abrir um módulo sem acesso (por link direto ou URL). */
export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const what = m === "admin" ? "a administração" : m && isAppModule(m) ? `o módulo ${MODULE_LABEL[m]}` : "esta área";
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="rounded-full bg-muted p-3 text-muted-foreground">
        <Lock className="size-6" />
      </span>
      <h1 className="text-xl font-semibold">Sem acesso</h1>
      <p className="text-sm text-muted-foreground">Não tens acesso a {what}. Se precisares, pede ao Founder que o ative nas Definições.</p>
      <Button asChild>
        <Link href="/dashboard">Voltar ao dashboard</Link>
      </Button>
    </div>
  );
}
