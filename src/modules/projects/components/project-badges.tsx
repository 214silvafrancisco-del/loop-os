"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { confirmMissing } from "@/modules/checklists/components/gate-confirm";
import { setProjectStatus } from "../actions";
import { PROJECT_STATUSES, PROJECT_STATUS_COLOR, PROJECT_STATUS_LABEL, type ProjectStatus } from "../validation";

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const color = PROJECT_STATUS_COLOR[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", className)} style={{ borderColor: color, color }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

/** Estado clicável no cabeçalho da obra. */
export function ProjectStatusSelect({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const color = PROJECT_STATUS_COLOR[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", pending && "opacity-60")} style={{ borderColor: color, color }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      <select
        aria-label="Estado da obra"
        value={status}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const next = e.target.value as ProjectStatus;
            let r = await setProjectStatus(projectId, next);
            if (!r.ok && "needsConfirm" in r) {
              if (!confirmMissing(r.missing, "mudar o estado")) {
                router.refresh();
                return;
              }
              r = await setProjectStatus(projectId, next, { force: true });
            }
            if (!r.ok && "error" in r) alert(r.error);
            router.refresh();
          })
        }
        className="cursor-pointer bg-transparent pr-1 text-xs font-medium outline-none"
        style={{ color }}
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s} className="text-foreground">{PROJECT_STATUS_LABEL[s]}</option>
        ))}
      </select>
    </span>
  );
}
