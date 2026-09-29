"use client";

import { Columns3, List } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type DealsView = "list" | "kanban";

/** Alterna Lista/Kanban. Guarda a escolha num cookie para a próxima visita. */
export function ViewToggle({ view, query }: { view: DealsView; query: string }) {
  function remember(v: DealsView) {
    // Escrita explícita via setter, para o compilador do React não a tratar como mutação de valor.
    const set = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")?.set;
    set?.call(document, `deals_view=${v}; path=/; max-age=31536000; samesite=lax`);
  }
  const base = query ? `/deals?${query}&` : "/deals?";
  const item = (v: DealsView, Icon: typeof List, label: string) => (
    <Link
      href={`${base}view=${v}`}
      onClick={() => remember(v)}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        view === v ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
      aria-current={view === v ? "page" : undefined}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
  return (
    <div className="flex rounded-lg bg-muted p-0.5">
      {item("list", List, "Lista")}
      {item("kanban", Columns3, "Kanban")}
    </div>
  );
}
