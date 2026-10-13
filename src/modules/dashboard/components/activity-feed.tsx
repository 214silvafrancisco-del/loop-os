import Link from "next/link";
import { auditWhen, describeAudit, type AuditLookups } from "@/core/audit/audit-timeline";
import type { ActivityRow } from "../queries";

/** Atividade recente (tarefas e processos), com link para o registo quando acessível. */
export function ActivityFeed({ rows, lookups }: { rows: ActivityRow[]; lookups: AuditLookups }) {
  if (rows.length === 0) return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Sem atividade recente.</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {rows.map((e) => {
        const d = describeAudit(e, lookups);
        if (!d) return null;
        return (
          <li key={e.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{e.userName ?? "Sistema"}</span>
              <span className="min-w-0">{d.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{auditWhen.format(e.at)}</span>
            </div>
            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              {e.href ? (
                <Link href={e.href} className="hover:underline">
                  {e.entityLabel}
                </Link>
              ) : (
                <span>{e.entityLabel}</span>
              )}
              {d.details.map((x, i) => (
                <span key={i}>· {x}</span>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
