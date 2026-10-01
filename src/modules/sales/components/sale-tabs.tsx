"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export const SALE_TABS = [
  { slug: "resumo", label: "Resumo" },
  { slug: "leads", label: "Leads" },
  { slug: "documentos", label: "Documentos" },
] as const;

export function SaleTabs({ saleId, counts }: { saleId: string; counts?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav ref={nav} className="relative -mx-4 mb-6 overflow-x-auto border-b px-4 md:mx-0 md:px-0 [scrollbar-width:none]">
      <ul className="flex gap-1">
        {SALE_TABS.map((t) => {
          const href = `/sales/${saleId}/${t.slug}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          const n = counts?.[t.slug];
          return (
            <li key={t.slug}>
              <Link
                href={href}
                className={cn(
                  "-mb-px flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors md:min-h-0",
                  active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {t.label}
                {n ? <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{n}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
