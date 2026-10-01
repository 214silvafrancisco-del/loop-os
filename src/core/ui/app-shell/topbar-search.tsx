"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Pesquisa no topo: procura negócios por morada, freguesia, referência,
 * contacto ou próxima ação (abre a lista filtrada). Em desktop é um campo
 * fixo; no telemóvel é um ícone que abre o campo a toda a largura.
 */
export function TopbarSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function submit(formData: FormData) {
    const q = String(formData.get("q") ?? "").trim();
    setOpen(false);
    router.push(q ? `/deals?view=list&q=${encodeURIComponent(q)}` : "/deals?view=list");
  }

  return (
    <>
      {/* Desktop */}
      <form action={submit} className="relative ml-auto hidden w-64 sm:block">
        <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
        <Input name="q" placeholder="Pesquisar negócios…" className="h-8 bg-background pl-8" aria-label="Pesquisar negócios" />
      </form>

      {/* Telemóvel: ícone → campo a toda a largura */}
      <Button type="button" variant="ghost" size="icon" className="ml-auto size-11 sm:hidden" aria-label="Pesquisar" onClick={() => setOpen(true)}>
        <Search className="size-6" />
      </Button>
      <form
        action={submit}
        className={cn("absolute inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-3 sm:hidden", !open && "hidden")}
      >
        <Search className="size-5 text-muted-foreground" />
        <Input name="q" placeholder="Morada, ref, contacto…" className="h-11 flex-1 text-base" autoFocus={open} aria-label="Pesquisar negócios" />
        <Button type="button" variant="ghost" size="icon" className="size-10" aria-label="Fechar pesquisa" onClick={() => setOpen(false)}>
          <X className="size-5" />
        </Button>
      </form>
    </>
  );
}
