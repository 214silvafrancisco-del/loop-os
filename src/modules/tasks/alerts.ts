import type { TaskEntity, TaskStatus } from "./schema";

/** Critérios temporais únicos para toda a app. */
export const SOON_DAYS = 7;

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "por_iniciar", label: "Por iniciar" },
  { value: "em_curso", label: "Em curso" },
  { value: "bloqueada", label: "Bloqueada" },
  { value: "concluida", label: "Concluída" },
];
export const TASK_STATUS_LABEL = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, s.label])) as Record<TaskStatus, string>;

export const TASK_ENTITY_LABEL: Record<TaskEntity, string> = { deal: "Negócio", project: "Obra", sale: "Venda", sale_lead: "Lead de venda" };

export type TaskAlert = "bloqueada" | "atrasada" | "sem_responsavel" | "proxima" | null;

export const isOpenStatus = (s: TaskStatus) => s !== "concluida";

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Alerta de uma tarefa aberta, por ordem de gravidade: bloqueada, atrasada
 * (prazo passado), sem responsável, próxima (prazo nos próximos 7 dias).
 */
export function taskAlert(t: { status: TaskStatus; dueDate: string | null; assigneeUserId: string | null }, today: string): TaskAlert {
  if (!isOpenStatus(t.status)) return null;
  if (t.status === "bloqueada") return "bloqueada";
  if (t.dueDate && t.dueDate < today) return "atrasada";
  if (!t.assigneeUserId) return "sem_responsavel";
  if (t.dueDate && t.dueDate <= addDaysIso(today, SOON_DAYS)) return "proxima";
  return null;
}

export const TASK_ALERT_LABEL: Record<Exclude<TaskAlert, null>, string> = {
  bloqueada: "bloqueada",
  atrasada: "atrasada",
  sem_responsavel: "sem responsável",
  proxima: "prazo próximo",
};
