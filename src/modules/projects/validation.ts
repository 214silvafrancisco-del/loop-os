import { z } from "zod";
import { optionalDate, optionalText, optionalUuid, stringsFromForm } from "@/core/lib/form-schemas";

export const PROJECT_STATUSES = ["planeamento", "a_iniciar", "em_curso", "pausada", "concluida", "cancelada"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planeamento: "Planeamento",
  a_iniciar: "A iniciar",
  em_curso: "Em curso",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  planeamento: "#8A8580",
  a_iniciar: "#E0A400",
  em_curso: "#F97B22",
  pausada: "#2E86C1",
  concluida: "#2E9E5B",
  cancelada: "#D64545",
};

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(2, "Indica o nome da obra."),
  status: z.enum(PROJECT_STATUSES),
  managerUserId: optionalUuid,
  plannedStart: optionalDate,
  actualStart: optionalDate,
  plannedEnd: optionalDate,
  actualEnd: optionalDate,
  notes: optionalText,
});

export type ProjectUpdateInput = z.input<typeof projectUpdateSchema>;
export const PROJECT_UPDATE_KEYS = ["name", "status", "managerUserId", "plannedStart", "actualStart", "plannedEnd", "actualEnd", "notes"] as const;

export function projectUpdateInputFromForm(formData: FormData): ProjectUpdateInput {
  return stringsFromForm(formData, PROJECT_UPDATE_KEYS) as unknown as ProjectUpdateInput;
}

export { addDaysIso as addDays, addMonthsIso as addMonths } from "@/core/lib/dates";
