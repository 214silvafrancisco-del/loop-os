import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GateMissing } from "../gate-rules";

type Props = {
  hard: GateMissing[];
  warn: GateMissing[];
  /** Ficha onde os links se resolvem, ex. /deals/<id>. */
  basePath: string;
  /** O que fica bloqueado, ex. "gerar a proposta". */
  action: string;
  className?: string;
};

/** Aviso de porta do processo: bloqueio (com links) ou só aviso. */
export function GateNotice({ hard, warn, basePath, action, className }: Props) {
  if (hard.length === 0 && warn.length === 0) return null;
  const blocked = hard.length > 0;
  const items = blocked ? hard : warn;
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", blocked ? "border-destructive/40 bg-destructive/5" : "border-warning/50 bg-warning/10", className)}>
      <p className="flex items-center gap-2 font-medium">
        {blocked ? <Lock className="size-4 text-destructive" /> : <AlertTriangle className="size-4 text-warning" />}
        {blocked ? `Ainda não é possível ${action}.` : `Podes ${action}, mas o processo tem passos em falta.`}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((m) => (
          <li key={m.label} className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-current opacity-50" />
            <span>{m.label}</span>
            {m.linkPath ? (
              <Link href={`${basePath}/${m.linkPath}`} className="inline-flex items-center gap-0.5 text-primary hover:underline">
                resolver <ArrowUpRight className="size-3.5" />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Ver tudo na tab{" "}
        <Link href={`${basePath}/processo`} className="underline">
          Processo
        </Link>
        .
      </p>
    </div>
  );
}
