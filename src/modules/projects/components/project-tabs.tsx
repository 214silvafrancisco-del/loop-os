"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const PROJECT_TABS = [
  { slug: "resumo", label: "Resumo" },
  { slug: "processo", label: "Processo" },
  { slug: "orcamento", label: "Orçamento" },
  { slug: "autos", label: "Autos" },
  { slug: "faturas", label: "Faturas" },
  { slug: "documentos", label: "Documentos" },
] as const;

export function ProjectTabs({ projectId, counts }: { projectId: string; counts?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-6 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1">
        {PROJECT_TABS.map((t) => {
          const href = `/projects/${projectId}/${t.slug}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          const n = counts?.[t.slug];
          return (
            <li key={t.slug}>
              <Link
                href={href}
                className={cn(
                  "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
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
