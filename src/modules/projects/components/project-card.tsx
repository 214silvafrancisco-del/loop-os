import Link from "next/link";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { ChecklistMini } from "@/modules/checklists/components/checklist-mini";
import type { ChecklistProgress } from "@/modules/checklists/queries";
import type { ProjectRow } from "../queries";
import { ProjectStatusBadge } from "./project-badges";

/** Cartão de obra para ecrãs pequenos. */
export function ProjectCard({ project: p, progress }: { project: ProjectRow; progress?: ChecklistProgress }) {
  const start = p.actualStart ? `início ${formatDate(p.actualStart)}` : p.plannedStart ? `início prev. ${formatDate(p.plannedStart)}` : null;
  const end = p.actualEnd ? `concluída ${formatDate(p.actualEnd)}` : p.plannedEnd ? `fim prev. ${formatDate(p.plannedEnd)}` : null;
  return (
    <article className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">{p.ref}</span>
            <ProjectStatusBadge status={p.status} />
          </div>
          <Link href={`/projects/${p.id}`} className="mt-0.5 block truncate text-base font-medium hover:underline">
            {p.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {p.addressLine}
            {p.parish ? ` · ${p.parish}` : ""}
            {p.typology ? ` · ${p.typology}` : ""}
          </p>
        </div>
        {p.finalPrice ? <span className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">{formatCurrency(p.finalPrice)}</span> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{[start, end].filter(Boolean).join(" · ") || "sem datas"}</span>
        <ChecklistMini done={progress?.done ?? null} total={progress?.total ?? null} href={`/projects/${p.id}/processo`} />
      </div>
      {p.managerName ? <p className="text-xs text-muted-foreground">resp. {p.managerName}</p> : null}
    </article>
  );
}
