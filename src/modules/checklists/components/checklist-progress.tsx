import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  done: number;
  total: number;
  /** Primeiro passo pendente (obrigatórios primeiro). */
  nextStep: { label: string; href: string; isRequired: boolean } | null;
  /** Ficha onde vive a tab Processo. */
  processHref: string;
  className?: string;
};

/** Barra de progresso do processo + próximo passo; vive no cabeçalho da ficha. */
export function ChecklistProgress({ done, total, nextStep, processHref, className }: Props) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2", className)}>
      <div className="flex items-center gap-2 text-sm">
        <ListChecks className="size-4 text-muted-foreground" />
        <Link href={processHref} className="font-medium hover:underline">
          Procedimento
        </Link>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {done}/{total} · {pct} %
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-[width]", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      {nextStep ? (
        <Link href={nextStep.href} className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <span>Próximo passo:</span>
          <span className="font-medium text-foreground">{nextStep.label}</span>
          {nextStep.isRequired ? <span className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">obrigatório</span> : null}
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : total > 0 ? (
        <p className="text-xs text-success">Todos os passos concluídos.</p>
      ) : null}
    </div>
  );
}
