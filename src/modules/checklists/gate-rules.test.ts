import { describe, expect, it } from "vitest";
import { gateForProjectStatus, gateForStage, missingSentence } from "./gate-rules";

describe("portas do processo", () => {
  const lead = { name: "Lead Morna", sort: 2, isPurchase: false };
  const proposta = { name: "Proposta", sort: 4, isPurchase: false };
  const compra = { name: "Compra", sort: 5, isPurchase: true };

  it("avançar para Proposta ou Compra aciona a porta; recuar não", () => {
    expect(gateForStage(lead, proposta)).toBe("deal:stage:proposta");
    expect(gateForStage(lead, compra)).toBe("deal:stage:compra");
    expect(gateForStage(compra, proposta)).toBeNull();
    expect(gateForStage(lead, { name: "Visita", sort: 3, isPurchase: false })).toBeNull();
  });

  it("estados da obra", () => {
    expect(gateForProjectStatus("em_curso")).toBe("project:em_curso");
    expect(gateForProjectStatus("concluida")).toBe("project:concluida");
    expect(gateForProjectStatus("pausada")).toBeNull();
  });

  it("frase do que falta", () => {
    expect(missingSentence([])).toBe("");
    expect(missingSentence([{ label: "A", linkPath: null, isRequired: true }, { label: "B", linkPath: "x", isRequired: false }], "Não é possível sem")).toBe("Não é possível sem: A, B.");
  });
});
