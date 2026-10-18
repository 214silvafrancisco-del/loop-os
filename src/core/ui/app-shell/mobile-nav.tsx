"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AppModule } from "@/core/auth/access";
import { NAV_ITEMS, visibleNavItems, type NavItem } from "@/core/navigation";

/** Ponto a pulsar enquanto a navegação deste item está pendente (o servidor prepara a página). */
function PendingDot() {
  const { pending } = useLinkStatus();
  return <span className={cn("absolute top-1.5 right-3 size-1.5 rounded-full bg-primary transition-opacity", pending ? "animate-pulse opacity-100" : "opacity-0")} aria-hidden />;
}

function Item({ item, active, onTap }: { item: NavItem; active: boolean; onTap: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onTap}
      className={cn("relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium select-none", active ? "text-primary" : "text-muted-foreground")}
      aria-current={active ? "page" : undefined}
    >
      <PendingDot />
      <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", active && "bg-primary/12")}>
        <Icon className="size-6" strokeWidth={active ? 2.25 : 2} />
      </span>
      {item.label}
    </Link>
  );
}

/**
 * Barra inferior em ecrãs pequenos (< md). O item tocado fica ativo de imediato
 * (otimista) e mostra um ponto a pulsar até a página chegar; junto com os
 * `loading.tsx`, a navegação responde ao toque mesmo quando o servidor demora.
 */
export function MobileNav({ user }: { user: { role: string; modules: readonly AppModule[] } }) {
  const pathname = usePathname();
  const items = visibleNavItems(NAV_ITEMS, user).filter((i) => i.mobile).slice(0, 5);
  const [tapped, setTapped] = useState<string | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    // Chegou a nova página: o estado otimista deixa de ser preciso.
    setSeenPath(pathname);
    setTapped(null);
  }
  const current = tapped ?? pathname;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden" style={{ WebkitTapHighlightColor: "transparent" }}>
      {items.map((item) => (
        <Item key={item.href} item={item} active={current === item.href || current.startsWith(item.href + "/")} onTap={() => setTapped(item.href)} />
      ))}
    </nav>
  );
}
