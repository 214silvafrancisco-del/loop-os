"use client";

import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/core/lib/format";
import { NativeSelect } from "@/core/ui/form-field";
import { completeTask, updateTask } from "../actions";
import { TASK_ALERT_LABEL, TASK_ENTITY_LABEL, TASK_STATUSES, taskAlert } from "../alerts";
import type { TaskListRow } from "../queries";
import type { TaskStatus } from "../schema";
import { NextTaskControl } from "./next-task-control";

const COLUMN_COLOR: Record<TaskStatus, string> = { por_iniciar: "bg-muted-foreground/50", em_curso: "bg-primary", bloqueada: "bg-destructive", concluida: "bg-success" };

function initials(name: string | null) {
  return (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

/** Corpo do cartão: registo, título, responsável, prazo e alerta. */
function TaskCardBody({ t, today, dragging }: { t: TaskListRow; today: string; dragging?: boolean }) {
  const alert = t.status === "concluida" ? null : taskAlert(t, today);
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-sm shadow-xs", dragging && "rotate-1 shadow-lg")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{TASK_ENTITY_LABEL[t.entityType]}</span>
          {t.href ? (
            <Link href={t.href} className="block truncate text-xs font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
              {t.entityLabel}
            </Link>
          ) : (
            <span className="block truncate text-xs text-muted-foreground">{t.entityLabel}</span>
          )}
        </div>
        {t.assigneeName ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary" title={t.assigneeName}>
            {initials(t.assigneeName)}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-warning/15 px-1.5 text-[10px] font-medium text-warning">sem responsável</span>
        )}
      </div>
      <p className={cn("font-medium", t.status === "concluida" && "text-muted-foreground line-through decoration-muted-foreground/50")}>{t.title}</p>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className={cn(alert === "atrasada" && "font-medium text-destructive")}>
          {t.status === "concluida" ? (t.completedAt ? `concluída ${formatDate(t.completedAt.toISOString().slice(0, 10))}` : "concluída") : t.dueDate ? formatDate(t.dueDate) : "sem prazo"}
        </span>
        {alert && alert !== "sem_responsavel" ? (
          <span className={cn("rounded-full px-1.5 text-[11px] font-medium", alert === "proxima" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>{TASK_ALERT_LABEL[alert]}</span>
        ) : null}
      </div>
      {t.status !== "concluida" ? (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <NextTaskControl compact entityType={t.entityType} entityId={t.entityId} task={{ id: t.id, title: t.title, dueDate: t.dueDate, status: t.status, assigneeUserId: t.assigneeUserId, assigneeName: t.assigneeName, openCount: 1 }} className="border border-dashed" />
        </div>
      ) : null}
    </div>
  );
}

function Card({ t, today }: { t: TaskListRow; today: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={cn("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")} {...listeners} {...attributes}>
      <TaskCardBody t={t} today={today} />
    </div>
  );
}

function Column({ status, label, tasks, today, active }: { status: TaskStatus; label: string; tasks: TaskListRow[]; today: string; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors", isOver && active && "border-primary bg-primary/5")}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn("size-2 rounded-full", COLUMN_COLOR[status])} />
        <span className="text-sm font-semibold">{label}</span>
        <span className="rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">{tasks.length}</span>
        {status === "concluida" ? <span className="ml-auto text-[11px] text-muted-foreground">últimos 7 dias</span> : null}
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {tasks.map((t) => (
          <Card key={t.id} t={t} today={today} />
        ))}
      </div>
    </div>
  );
}

/**
 * Kanban de tarefas por estado: Por iniciar → Em curso → Bloqueada → Concluída.
 * Arrastar muda o estado (largar em Concluída conclui; tirar de Concluída reabre).
 * Em telemóvel: secções empilhadas com um seletor de estado por cartão.
 */
export function TasksKanban({ tasks: initial, today }: { tasks: TaskListRow[]; today: string }) {
  const router = useRouter();
  const [seen, setSeen] = useState(initial);
  const [tasks, setTasks] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setTasks(initial);
  }
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  function moveLocally(id: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status, completedAt: status === "concluida" ? new Date() : null } : t)));
  }

  function commit(t: TaskListRow, status: TaskStatus) {
    const previous = t.status;
    moveLocally(t.id, status);
    startTransition(async () => {
      const r = status === "concluida" ? await completeTask(t.id) : await updateTask(t.id, { status });
      if (r.ok) {
        router.refresh();
        return;
      }
      moveLocally(t.id, previous);
      alert(r.error);
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const t = tasks.find((x) => x.id === String(e.active.id));
    const status = e.over ? (String(e.over.id) as TaskStatus) : null;
    if (!t || !status || status === t.status) return;
    commit(t, status);
  }
  const active = activeId ? tasks.find((t) => t.id === activeId) : null;
  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s);

  return (
    <>
      <div className="flex flex-col gap-4 md:hidden">
        {TASK_STATUSES.map((st) => {
          const list = byStatus(st.value);
          return (
            <section key={st.value}>
              <header className="mb-2 flex items-center gap-2">
                <span className={cn("size-2 rounded-full", COLUMN_COLOR[st.value])} />
                <span className="text-sm font-semibold">{st.label}</span>
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </header>
              {list.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">Sem tarefas neste estado.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {list.map((t) => (
                    <div key={t.id} className="flex flex-col gap-1.5">
                      <TaskCardBody t={t} today={today} />
                      <NativeSelect aria-label={`Mover «${t.title}» para outro estado`} value={t.status} onChange={(e) => commit(t, e.target.value as TaskStatus)} className="h-10 text-sm">
                        {TASK_STATUSES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.value === t.status ? `Estado: ${o.label}` : `Mover para ${o.label}`}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <DndContext id="tasks-kanban" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="hidden gap-3 overflow-x-auto pb-3 md:flex">
          {TASK_STATUSES.map((st) => (
            <Column key={st.value} status={st.value} label={st.label} tasks={byStatus(st.value)} today={today} active={Boolean(activeId)} />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <div className="w-72">
              <TaskCardBody t={active} today={today} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
