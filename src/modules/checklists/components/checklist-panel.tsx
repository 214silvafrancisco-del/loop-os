"use client";

import { ArrowUpRight, CheckCircle2, Circle, Lock, Minus, MoreHorizontal, RefreshCw, UserRound, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { UserOption } from "@/modules/settings/queries";
import { assignChecklistItem, refreshChecklist, setChecklistItemStatus } from "../actions";
import type { ChecklistItemView, ChecklistView } from "../queries";

const when = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" });

type Props = { view: ChecklistView; users: UserOption[]; basePath: string };

/**
 * Checklist do processo: secções, itens automáticos (seguem os dados) e
 * manuais (checkbox), "não aplicável" com nota, responsável por item e links
 * para onde cada passo se resolve.
 */
export function ChecklistPanel({ view, users, basePath }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [naTarget, setNaTarget] = useState<ChecklistItemView | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  const pct = view.totalCount === 0 ? 0 : Math.round((view.doneCount / view.totalCount) * 100);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-base font-semibold">{view.templateName}</h2>
            <p className="text-xs text-muted-foreground">
              Procedimento v{view.templateVersion} · {view.doneCount} de {view.totalCount} passos concluídos
              {view.syncedAt ? ` · verificado ${when.format(view.syncedAt)}` : ""}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{pct} %</span>
            <Button variant="ghost" size="icon" className="size-8" title="Verificar agora" disabled={pending} onClick={() => run(() => refreshChecklist(view.entityType, view.entityId))}>
              <RefreshCw className={cn("size-4", pending && "animate-spin")} />
            </Button>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        {view.nextStep ? (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">Próximo passo: </span>
            <span className="font-medium">{view.nextStep.label}</span>
            {view.nextStep.linkPath ? (
              <Link href={`${basePath}/${view.nextStep.linkPath}`} className="ml-2 inline-flex items-center gap-0.5 text-primary hover:underline">
                resolver <ArrowUpRight className="size-3.5" />
              </Link>
            ) : null}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          <Zap className="mr-1 inline size-3" />
          Os passos automáticos concluem-se sozinhos a partir dos dados do negócio; só os manuais se marcam à mão. Qualquer passo pode ficar «não aplicável».
        </p>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>

      {view.sections.map((s) => (
        <section key={s.code} className="rounded-xl border bg-card">
          <header className="flex items-center gap-3 border-b px-4 py-2.5">
            <h3 className="text-sm font-semibold">{s.label}</h3>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {s.done}/{s.total}
            </span>
            <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: s.total ? `${(s.done / s.total) * 100}%` : "0%" }} />
            </div>
          </header>
          <ul className="divide-y">
            {s.items.map((it) => (
              <ChecklistItemRow
                key={it.id}
                item={it}
                users={users}
                basePath={basePath}
                pending={pending}
                onToggle={(done) => run(() => setChecklistItemStatus(it.id, { status: done ? "done" : "pending" }))}
                onReset={() => run(() => setChecklistItemStatus(it.id, { status: "pending" }))}
                onNotApplicable={() => setNaTarget(it)}
                onAssign={(userId) => run(() => assignChecklistItem(it.id, userId))}
              />
            ))}
          </ul>
        </section>
      ))}

      <NotApplicableDialog
        item={naTarget}
        onClose={() => setNaTarget(null)}
        onConfirm={(note) => {
          const it = naTarget;
          setNaTarget(null);
          if (it) run(() => setChecklistItemStatus(it.id, { status: "not_applicable", note }));
        }}
      />
    </div>
  );
}

type RowProps = {
  item: ChecklistItemView;
  users: UserOption[];
  basePath: string;
  pending: boolean;
  onToggle: (done: boolean) => void;
  onReset: () => void;
  onNotApplicable: () => void;
  onAssign: (userId: string | null) => void;
};

function ChecklistItemRow({ item, users, basePath, pending, onToggle, onReset, onNotApplicable, onAssign }: RowProps) {
  const na = item.status === "not_applicable";
  const done = item.status === "done";
  const blocked = Boolean(item.blockedBy);
  const href = item.linkPath ? `${basePath}/${item.linkPath}` : null;

  const control = (() => {
    if (na) return <Minus className="size-4 text-muted-foreground/60" aria-label="Não aplicável" />;
    if (item.kind === "manual") {
      return <Checkbox checked={done} disabled={pending || blocked} onCheckedChange={(v) => onToggle(v === true)} aria-label={item.label} />;
    }
    if (done) return <CheckCircle2 className="size-4 text-success" aria-label="Concluído automaticamente" />;
    if (blocked) return <Lock className="size-4 text-muted-foreground" aria-label="Bloqueado" />;
    return <Circle className="size-4 text-muted-foreground/50" aria-label="Pendente" />;
  })();

  const meta: string[] = [];
  if (done && item.completedAt) meta.push(`${item.source === "auto" ? "automático" : "concluído"}${item.completedByName ? ` por ${item.completedByName}` : ""} · ${when.format(item.completedAt)}`);
  if (na) meta.push(item.source === "context" ? "não aplicável neste momento (segue os dados)" : `não aplicável${item.naNote ? `: ${item.naNote}` : ""}`);
  if (blocked) meta.push(`depende de: ${item.blockedBy}`);
  if (!done && !na && item.help) meta.push(item.help);

  return (
    <li className={cn("flex items-start gap-3 px-4 py-2.5", na && "opacity-60")}>
      <div className="mt-0.5 flex size-5 items-center justify-center" title={item.kind === "auto" ? "Conclui-se automaticamente a partir dos dados" : "Marca-se à mão"}>
        {control}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn("text-sm", na && "line-through", done && "text-muted-foreground")}>{item.label}</span>
          {item.isRequired ? <span className="rounded bg-primary/10 px-1 text-[10px] font-medium uppercase tracking-wide text-primary">obrigatório</span> : null}
          {item.kind === "auto" ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[10px] text-muted-foreground">
              <Zap className="size-2.5" /> auto
            </span>
          ) : null}
          {item.detail ? <span className="rounded bg-muted px-1 text-[10px] tabular-nums text-muted-foreground">{item.detail}</span> : null}
          {item.assigneeName ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <UserRound className="size-3" /> {item.assigneeName}
            </span>
          ) : null}
        </div>
        {meta.length ? <p className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {href && !done && !na && !blocked ? (
          <Button asChild variant="ghost" size="sm" className="h-7 gap-0.5 px-2 text-xs">
            <Link href={href}>
              resolver <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Mais opções" disabled={pending}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {na ? (
              <DropdownMenuItem onSelect={onReset}>Voltar a aplicar</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onNotApplicable}>Não aplicável…</DropdownMenuItem>
            )}
            {item.kind === "manual" && done ? <DropdownMenuItem onSelect={onReset}>Repor como pendente</DropdownMenuItem> : null}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Responsável</DropdownMenuLabel>
            {users.map((u) => (
              <DropdownMenuItem key={u.id} onSelect={() => onAssign(u.id)} className={cn(u.id === item.assigneeUserId && "font-medium")}>
                {u.fullName}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => onAssign(null)} className="text-muted-foreground">
              Sem responsável
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function NotApplicableDialog({ item, onClose, onConfirm }: { item: ChecklistItemView | null; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(o) => {
        if (!o) {
          setNote("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Não aplicável</DialogTitle>
          <DialogDescription>«{item?.label}» deixa de contar para o progresso deste negócio. Diz porquê, para quem vier a seguir.</DialogDescription>
        </DialogHeader>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ex.: prédio de 1930, não tem licença de utilização" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const n = note.trim();
              setNote("");
              onConfirm(n);
            }}
          >
            Marcar como não aplicável
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
