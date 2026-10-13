"use client";

import { CalendarClock, Check, ChevronRight, Lock, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDate } from "@/core/lib/format";
import { NativeSelect } from "@/core/ui/form-field";
import { completeTask, createTask, listAssignees, updateTask } from "../actions";
import { TASK_STATUSES, taskAlert } from "../alerts";
import type { NextTask } from "../queries";
import type { TaskEntity, TaskStatus } from "../schema";

type Props = {
  entityType: TaskEntity;
  entityId: string;
  task: NextTask | null;
  /** Compacto para cartões; normal para fichas e dashboard. */
  compact?: boolean;
  className?: string;
  /** Link para o histórico (tab Tarefas do registo), quando existe. */
  historyHref?: string;
};

function initials(name: string | null) {
  return (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/**
 * Próxima tarefa de um registo: título, responsável e prazo, com edição num
 * popover e «concluir e criar a seguinte» num só passo.
 */
export function NextTaskControl({ entityType, entityId, task, compact, className, historyHref }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "complete">("edit");
  const [users, setUsers] = useState<{ id: string; fullName: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const alert = task ? taskAlert(task, todayIso()) : null;

  useEffect(() => {
    if (open && users === null) listAssignees().then(setUsers).catch(() => setUsers([]));
  }, [open, users]);

  function close() {
    setOpen(false);
    setMode("edit");
    setError(null);
  }

  function save(fd: FormData) {
    setError(null);
    const input = {
      title: String(fd.get("title") ?? ""),
      assigneeUserId: String(fd.get("assigneeUserId") ?? ""),
      dueDate: String(fd.get("dueDate") ?? ""),
      status: (String(fd.get("status") ?? "por_iniciar") as TaskStatus) || "por_iniciar",
    };
    startTransition(async () => {
      const r = task ? await updateTask(task.id, input) : await createTask(entityType, entityId, input);
      if (!r.ok) return setError(r.error);
      close();
      router.refresh();
    });
  }

  function finish(fd: FormData) {
    if (!task) return;
    setError(null);
    const nextTitle = String(fd.get("nextTitle") ?? "").trim();
    const next = nextTitle ? { title: nextTitle, assigneeUserId: String(fd.get("nextAssigneeUserId") ?? ""), dueDate: String(fd.get("nextDueDate") ?? "") } : null;
    startTransition(async () => {
      const r = await completeTask(task.id, next);
      if (!r.ok) return setError(r.error);
      close();
      router.refresh();
    });
  }

  const tone = alert === "atrasada" || alert === "bloqueada" ? "text-destructive" : alert === "sem_responsavel" ? "text-warning" : alert === "proxima" ? "text-primary" : "text-muted-foreground";

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger
        className={cn("flex w-full items-start gap-1.5 rounded-md text-left text-xs hover:bg-accent", compact ? "px-1 py-0.5" : "px-2 py-1", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {task?.status === "bloqueada" ? <Lock className="mt-0.5 size-3.5 shrink-0 text-destructive" /> : <CalendarClock className={cn("mt-0.5 size-3.5 shrink-0", tone)} />}
        {!task ? (
          <span className="text-muted-foreground">Definir próxima tarefa</span>
        ) : (
          <span className="flex min-w-0 flex-1 items-start gap-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{task.title}</span>
              <span className={cn("block", tone)}>
                {task.dueDate ? formatDate(task.dueDate) : "sem prazo"}
                {alert === "atrasada" ? " · atrasada" : alert === "bloqueada" ? " · bloqueada" : alert === "sem_responsavel" ? " · sem responsável" : task.status === "em_curso" ? " · em curso" : ""}
                {task.openCount > 1 ? ` · +${task.openCount - 1}` : ""}
              </span>
            </span>
            <span
              className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", task.assigneeName ? "bg-primary/15 text-primary" : "border border-dashed text-muted-foreground")}
              title={task.assigneeName ?? "Sem responsável"}
            >
              {task.assigneeName ? initials(task.assigneeName) : "?"}
            </span>
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80" onClick={(e) => e.stopPropagation()}>
        {mode === "edit" ? (
          <form action={save} className="flex flex-col gap-2.5">
            <Input name="title" placeholder="O que fazer a seguir" defaultValue={task?.title ?? ""} autoFocus required className="h-10 md:h-9" />
            <div className="grid grid-cols-2 gap-2">
              <NativeSelect name="assigneeUserId" defaultValue={task?.assigneeUserId ?? ""} aria-label="Responsável" className="h-10 md:h-9">
                <option value="">Responsável…</option>
                {(users ?? (task?.assigneeUserId ? [{ id: task.assigneeUserId, fullName: task.assigneeName ?? "…" }] : [])).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </NativeSelect>
              <Input name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} aria-label="Data-limite" className="h-10 md:h-9" />
            </div>
            {task ? (
              <NativeSelect name="status" defaultValue={task.status} aria-label="Estado" className="h-10 md:h-9">
                {TASK_STATUSES.filter((s) => s.value !== "concluida").map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <input type="hidden" name="status" value="por_iniciar" />
            )}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex items-center justify-between gap-2">
              {task ? (
                <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setMode("complete")} disabled={pending}>
                  <Check className="size-4" /> Concluir
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                {historyHref ? (
                  <a href={historyHref} className="inline-flex items-center text-xs text-muted-foreground hover:underline">
                    histórico <ChevronRight className="size-3" />
                  </a>
                ) : null}
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "…" : task ? "Guardar" : "Criar"}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form action={finish} className="flex flex-col gap-2.5">
            <p className="text-sm">
              Concluir <span className="font-medium">«{task?.title}»</span> e registar a seguinte:
            </p>
            <Input name="nextTitle" placeholder="Tarefa seguinte (opcional)" autoFocus className="h-10 md:h-9" />
            <div className="grid grid-cols-2 gap-2">
              <NativeSelect name="nextAssigneeUserId" defaultValue={task?.assigneeUserId ?? ""} aria-label="Responsável da seguinte" className="h-10 md:h-9">
                <option value="">Mesmo responsável</option>
                {(users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </NativeSelect>
              <Input name="nextDueDate" type="date" aria-label="Data-limite da seguinte" className="h-10 md:h-9" />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("edit")} disabled={pending}>
                Voltar
              </Button>
              <Button type="submit" size="sm" className="gap-1" disabled={pending}>
                <Plus className="size-4" /> {pending ? "…" : "Concluir"}
              </Button>
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
