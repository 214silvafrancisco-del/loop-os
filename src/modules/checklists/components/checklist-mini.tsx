import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  done: number | null;
  total: number | null;
  /** Itens obrigatórios ainda pendentes. */
  requiredMissing?: number | null;
  href?: string;
  className?: string;
};

/** Progresso compacto do processo, para tabelas e cartões do Kanban. */
export function ChecklistMini({ done, total, requiredMissing, href, className }: Props) {
  if (done === null || total === null || total === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  }
  const pct = Math.round((done / total) * 100);
  const missing = requiredMissing ?? 0;
  const body = (
    <span className={cn("inline-flex items-center gap-1.5 text-xs tabular-nums", className)} title={missing ? `${missing} obrigatório(s) em falta` : `${done} de ${total} passos`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-muted-foreground">{pct} %</span>
      {missing ? <span className="size-1.5 rounded-full bg-destructive" aria-label={`${missing} obrigatórios em falta`} /> : null}
    </span>
  );
  return href ? (
    <Link href={href} className="hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}
