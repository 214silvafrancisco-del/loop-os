import { describe, expect, it } from "vitest";
import { addDaysIso, taskAlert } from "./alerts";

const today = "2026-10-13";

describe("alertas de tarefas", () => {
  it("concluída nunca alerta", () => {
    expect(taskAlert({ status: "concluida", dueDate: "2026-01-01", assigneeUserId: null }, today)).toBeNull();
  });
  it("bloqueada tem prioridade sobre o atraso", () => {
    expect(taskAlert({ status: "bloqueada", dueDate: "2026-01-01", assigneeUserId: "u" }, today)).toBe("bloqueada");
  });
  it("prazo passado é atrasada; mesmo sem responsável", () => {
    expect(taskAlert({ status: "por_iniciar", dueDate: "2026-10-12", assigneeUserId: null }, today)).toBe("atrasada");
    expect(taskAlert({ status: "em_curso", dueDate: today, assigneeUserId: "u" }, today)).toBe("proxima");
  });
  it("sem responsável antes do prazo próximo", () => {
    expect(taskAlert({ status: "por_iniciar", dueDate: "2026-10-15", assigneeUserId: null }, today)).toBe("sem_responsavel");
    expect(taskAlert({ status: "por_iniciar", dueDate: null, assigneeUserId: null }, today)).toBe("sem_responsavel");
  });
  it("prazo nos próximos 7 dias é próxima; depois disso nada", () => {
    expect(taskAlert({ status: "por_iniciar", dueDate: addDaysIso(today, 7), assigneeUserId: "u" }, today)).toBe("proxima");
    expect(taskAlert({ status: "por_iniciar", dueDate: addDaysIso(today, 8), assigneeUserId: "u" }, today)).toBeNull();
    expect(taskAlert({ status: "por_iniciar", dueDate: null, assigneeUserId: "u" }, today)).toBeNull();
  });
});
