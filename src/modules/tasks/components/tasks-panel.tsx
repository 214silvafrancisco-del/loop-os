"use client";

import { Check, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/core/lib/format";
import { deleteTask, updateTask } from "../actions";
import { TASK_STATUS_LABEL, taskAlert } from "../alerts";
import type { TaskRow } from "../queries";
import type { TaskEntity } from "../schema";
import { NextTaskControl } from "./next-task-control";

const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Tarefas de um registo: abertas (editáveis) e histórico das concluídas. */
export function TasksPanel({ entityType, entityId, tasks, canDelete }: { entityType: TaskEntity; entityId: string; tasks: TaskRow[]; canDelete: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const today = todayIso();
  const open = tasks.filter((t) => t.status !== "concluida");
  const done = tasks.filter((t) => t.status === "concluida");

  function reopen(id: string) {
    startTransition(async () => {
      const r = await updateTask(id, { status: "por_iniciar" });
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }
  function remove(t: TaskRow) {
    if (!confirm(`Apagar a tarefa «${t.title}»? Fica registado na auditoria.`)) return;
    startTransition(async () => {
      const r = await deleteTask(t.id);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {open.length} {open.length === 1 ? "aberta" : "abertas"} · {done.length} {done.length === 1 ? "concluída" : "concluídas"}
        </p>
        <Button type="button" size="sm" className="h-10 gap-1 md:h-8" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Nova tarefa
        </Button>
      </div>
      {creating ? (
        <div className="rounded-xl border border-dashed bg-card p-2">
          <NextTaskControl entityType={entityType} entityId={entityId} task={null} />
          <p className="px-2 pb-1 text-xs text-muted-foreground">Abre o campo acima, preenche e carrega em «Criar».</p>
        </div>
      ) : null}
      {open.length === 0 ? <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Sem tarefas abertas. Define a próxima para o registo não ficar parado.</p> : null}
      <ul className="flex flex-col gap-2">
        {open.map((t) => {
          const a = taskAlert(t, today);
          return (
            <li key={t.id} className={cn("flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3", a === "atrasada" || a === "bloqueada" ? "border-destructive/40" : "")}>
              <div className="min-w-0 flex-1">
                <NextTaskControl entityType={entityType} entityId={entityId} task={{ id: t.id, title: t.title, dueDate: t.dueDate, status: t.status, assigneeUserId: t.assigneeUserId, assigneeName: t.assigneeName, openCount: 1 }} />
              </div>
              <span className="text-xs text-muted-foreground">
                {t.status === "bloqueada" ? <Lock className="mr-1 inline size-3 text-destructive" /> : null}
                {TASK_STATUS_LABEL[t.status]} · criada {formatDate(t.createdAt)}
              </span>
              {canDelete ? (
                <Button type="button" variant="ghost" size="icon" className="size-10 text-muted-foreground hover:text-destructive md:size-8" aria-label="Apagar tarefa" onClick={() => remove(t)}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {done.length ? (
        <details className="rounded-xl border bg-muted/30 px-3 py-2" open={open.length === 0}>
          <summary className="cursor-pointer text-sm font-medium">Histórico ({done.length})</summary>
          <ul className="mt-2 divide-y">
            {done.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <Check className="size-4 shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="text-xs text-muted-foreground">
                  {t.assigneeName ? `${t.assigneeName} · ` : ""}
                  concluída {t.completedAt ? formatDate(t.completedAt) : ""}
                  {t.completedByName ? ` por ${t.completedByName}` : ""}
                  {t.dueDate ? ` · prazo ${formatDate(t.dueDate)}` : ""}
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => reopen(t.id)} title="Reabrir">
                  <RotateCcw className="size-3.5" /> reabrir
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
