import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ModuleIndicators } from "../queries";

/** Indicadores compactos por módulo acessível, calculados a partir dos registos. */
export function ModuleIndicatorsGrid({ groups }: { groups: ModuleIndicators[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <div key={g.module} className="rounded-lg border bg-card p-3">
          <Link href={g.href} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:underline">
            {g.label}
          </Link>
          <dl className="mt-2 flex flex-col gap-1">
            {g.items.map((it) => (
              <div key={it.label} className="flex items-center justify-between gap-2 text-sm">
                <dt className="text-muted-foreground">
                  <Link href={it.href} className="hover:underline">
                    {it.label}
                  </Link>
                </dt>
                <dd className={cn("tabular-nums font-medium", it.value > 0 && it.tone === "bad" && "text-destructive", it.value > 0 && it.tone === "warn" && "text-warning")}>{it.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
