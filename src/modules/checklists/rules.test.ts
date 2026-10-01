import { describe, expect, it } from "vitest";
import { nextItemState, summarize, type ItemState } from "./engine";
import { evaluateCondition, evaluateRule, KNOWN_CONDITION_KEYS, KNOWN_RULE_KEYS, previousMonthStart, type DealContext, type ProjectContext, type RuleContext } from "./rules";
import { CHECKLIST_TEMPLATES } from "./templates";

const freshLead: DealContext = {
  deal: {
    name: null, askingPrice: 250000, sourceChannelId: "src", sourceChannelName: "Sites", sourceContactId: null, contactPhone: null,
    ownerUserId: "u1", nextAction: null, nextActionDate: null, maxPrice: null, finalPrice: null, deedDate: null, cpcvDate: null,
    status: "active", sourceCommissionPct: null, stageIsPurchase: false,
  },
  property: { addressLine: "(morada por confirmar · 2025-03-01)", parish: "Benfica", municipality: null, typology: "T2", grossArea: null, floor: null, constructionYear: null, condition: null },
  docCategories: [],
  comparablesCount: 1,
  activeScenario: null,
  proposals: { count: 0, sent: 0, decided: 0 },
  today: "2026-10-01",
};

const readyDeal: DealContext = {
  deal: {
    ...freshLead.deal, name: "T2 Benfica", sourceContactId: "c1", contactPhone: "+351910000000", nextAction: "Ligar", nextActionDate: "2026-10-02",
    maxPrice: 230000, sourceChannelName: "Consultor", sourceCommissionPct: 0.03,
  },
  property: { addressLine: "Rua A 12", parish: "Benfica", municipality: "Lisboa", typology: "T2", grossArea: 80, floor: "2", constructionYear: 1975, condition: "para_obras" },
  docCategories: ["caderneta predial", "certidao permanente", "fotografias"],
  comparablesCount: 4,
  activeScenario: { ltvPct: 0.6 },
  proposals: { count: 1, sent: 1, decided: 0 },
  today: "2026-10-01",
};

const deal = (ctx: DealContext): RuleContext => ({ entityType: "deal", ctx });
const proj = (ctx: ProjectContext): RuleContext => ({ entityType: "project", ctx });

describe("regras do negócio", () => {
  it("lead acabada de registar: o essencial pendente com detalhe", () => {
    expect(evaluateRule("deal.identified", deal(freshLead)).status).toBe("done"); // tipologia + freguesia
    expect(evaluateRule("deal.address_complete", deal(freshLead))).toEqual({ status: "pending", detail: "morada por confirmar" });
    expect(evaluateRule("deal.asking_price", deal(freshLead)).status).toBe("done");
    expect(evaluateRule("deal.contact", deal(freshLead)).status).toBe("pending");
    expect(evaluateRule("deal.property_data", deal(freshLead))).toEqual({ status: "pending", detail: "1 de 5" });
    expect(evaluateRule("deal.comparables", deal(freshLead))).toEqual({ status: "pending", detail: "1 de 3" });
    expect(evaluateRule("deal.business_plan", deal(freshLead)).status).toBe("pending");
    expect(evaluateRule("doc:Caderneta predial", deal(freshLead)).status).toBe("pending");
  });

  it("negócio analisado: tudo concluído, documentos por nome normalizado", () => {
    for (const key of ["deal.address_complete", "deal.contact", "deal.property_data", "deal.comparables", "deal.business_plan", "deal.max_price", "deal.proposal_generated", "deal.proposal_sent"]) {
      expect(evaluateRule(key, deal(readyDeal)).status, key).toBe("done");
    }
    expect(evaluateRule("doc:Certidão permanente", deal(readyDeal)).status).toBe("done");
    expect(evaluateRule("doc:Plantas", deal(readyDeal)).status).toBe("pending");
    expect(evaluateRule("deal.outcome", deal(readyDeal)).status).toBe("pending");
  });

  it("contacto sem telefone fica pendente com nota", () => {
    const c = { ...readyDeal, deal: { ...readyDeal.deal, contactPhone: null } };
    expect(evaluateRule("deal.contact", deal(c))).toEqual({ status: "pending", detail: "contacto sem telefone" });
  });

  it("resultado: proposta decidida ou negócio excluído", () => {
    expect(evaluateRule("deal.outcome", deal({ ...readyDeal, proposals: { count: 1, sent: 1, decided: 1 } })).status).toBe("done");
    expect(evaluateRule("deal.outcome", deal({ ...freshLead, deal: { ...freshLead.deal, status: "excluded" } })).status).toBe("done");
  });

  it("condições de compra dizem o que falta", () => {
    expect(evaluateRule("deal.purchase_terms", deal(readyDeal))).toEqual({ status: "pending", detail: "falta valor final e escritura" });
    const bought = { ...readyDeal, deal: { ...readyDeal.deal, finalPrice: 220000, deedDate: "2026-11-01" } };
    expect(evaluateRule("deal.purchase_terms", deal(bought)).status).toBe("done");
  });

  it("escritura registada: só com data já passada", () => {
    expect(evaluateRule("deal.deed_done", deal(readyDeal))).toEqual({ status: "pending", detail: "sem data de escritura" });
    expect(evaluateRule("deal.deed_done", deal({ ...readyDeal, deal: { ...readyDeal.deal, deedDate: "2026-11-01" } }))).toEqual({ status: "pending", detail: "escritura marcada para 2026-11-01" });
    expect(evaluateRule("deal.deed_done", deal({ ...readyDeal, deal: { ...readyDeal.deal, deedDate: "2026-09-15" } }))).toEqual({ status: "done", detail: "2026-09-15" });
  });

  it("regra desconhecida não rebenta", () => {
    expect(evaluateRule("deal.nao_existe", deal(readyDeal))).toEqual({ status: "pending", detail: "regra desconhecida" });
  });
});

describe("condições de contexto", () => {
  it("licença de utilização só a partir de 1951 (ano desconhecido aplica-se)", () => {
    expect(evaluateCondition("needs_licenca", deal(readyDeal))).toBe(true);
    expect(evaluateCondition("needs_licenca", deal(freshLead))).toBe(true);
    expect(evaluateCondition("needs_licenca", deal({ ...readyDeal, property: { ...readyDeal.property, constructionYear: 1940 } }))).toBe(false);
  });
  it("financiamento só com LTV no cenário ativo", () => {
    expect(evaluateCondition("has_financing", deal(readyDeal))).toBe(true);
    expect(evaluateCondition("has_financing", deal({ ...readyDeal, activeScenario: { ltvPct: 0 } }))).toBe(false);
    expect(evaluateCondition("has_financing", deal(freshLead))).toBe(false);
  });
  it("compra: itens só a partir da fase Compra", () => {
    expect(evaluateCondition("stage_purchase", deal(readyDeal))).toBe(false);
    expect(evaluateCondition("stage_purchase", deal({ ...readyDeal, deal: { ...readyDeal.deal, stageIsPurchase: true } }))).toBe(true);
  });
  it("condição desconhecida aplica-se", () => {
    expect(evaluateCondition("xpto", deal(freshLead))).toBe(true);
  });
});

const supplier = (p: Partial<ProjectContext["suppliers"][number]> & { id: string; name: string }): ProjectContext["suppliers"][number] => ({
  controlMode: "autos",
  budgeted: 10000,
  closedCount: 0,
  draftCount: 0,
  lastClosedMonth: null,
  lastClosedCumulative: 0,
  ...p,
});

const projectBase: ProjectContext = {
  project: { managerUserId: "u1", plannedStart: "2026-10-01", plannedEnd: "2027-02-01", actualStart: null, actualEnd: null, status: "planeamento" },
  budget: { lineCount: 20, total: 22000, chaptersWithCategory: 5, chapterCount: 5, chaptersWithSupplier: 4, leafCount: 15 },
  docCategories: ["contrato de empreitada"],
  suppliers: [supplier({ id: "emp", name: "Empreiteiro", budgeted: 15000 }), supplier({ id: "cax", name: "Caixilheiro", budgeted: 7000, controlMode: "fatura" })],
  invoices: { count: 0, total: 0, paid: 0, overdueUnpaid: 0 },
  paymentsCount: 0,
  today: "2026-10-15",
};

describe("regras da obra", () => {
  it("planeamento: orçamento existe, capítulos com fornecedor 4 de 5, início pendente", () => {
    expect(evaluateRule("project.budget_exists", proj(projectBase)).status).toBe("done");
    expect(evaluateRule("project.budget_suppliers", proj(projectBase))).toEqual({ status: "pending", detail: "4 de 5" });
    expect(evaluateRule("project.started", proj(projectBase)).status).toBe("pending");
    expect(evaluateRule("doc:Contrato de empreitada", proj(projectBase)).status).toBe("done");
    expect(evaluateRule("project.invoices_paid", proj(projectBase))).toEqual({ status: "pending", detail: "sem faturas" });
  });

  it("autos em dia: só fornecedores por autos, cada um com o auto do mês anterior ou atual", () => {
    const inProgress = { ...projectBase, project: { ...projectBase.project, status: "em_curso" as const } };
    expect(evaluateCondition("project_in_progress", proj(inProgress))).toBe(true);
    expect(evaluateRule("project.measurements_current", proj(inProgress))).toEqual({ status: "pending", detail: "0 de 1 fornecedor em dia" });
    const sep = { ...inProgress, suppliers: [supplier({ id: "emp", name: "Empreiteiro", closedCount: 1, lastClosedMonth: "2026-09-01" }), projectBase.suppliers[1]!] };
    expect(evaluateRule("project.measurements_current", proj(sep))).toEqual({ status: "done", detail: "1 de 1 fornecedor em dia" });
    const jul = { ...sep, suppliers: [supplier({ id: "emp", name: "Empreiteiro", closedCount: 1, lastClosedMonth: "2026-07-01" })] };
    expect(evaluateRule("project.measurements_current", proj(jul)).status).toBe("pending");
    const onlyInvoices = { ...inProgress, suppliers: [projectBase.suppliers[1]!] };
    expect(evaluateRule("project.measurements_current", proj(onlyInvoices)).status).toBe("na");
  });

  it("fecho: autos a 100 %, faturas pagas, sem rascunhos", () => {
    const closing = {
      ...projectBase,
      project: { ...projectBase.project, status: "concluida" as const, actualStart: "2026-10-01", actualEnd: "2027-01-20" },
      suppliers: [supplier({ id: "emp", name: "Empreiteiro", budgeted: 15000, closedCount: 4, draftCount: 1, lastClosedMonth: "2027-01-01", lastClosedCumulative: 15000 }), projectBase.suppliers[1]!],
      invoices: { count: 6, total: 22000, paid: 21000, overdueUnpaid: 1 },
      paymentsCount: 5,
    };
    expect(evaluateRule("project.no_draft_measurements", proj(closing))).toEqual({ status: "pending", detail: "1 em rascunho" });
    expect(evaluateRule("project.measurements_complete", proj(closing))).toEqual({ status: "done", detail: "1 de 1 fornecedor a 100 %" });
    expect(evaluateRule("project.first_measurement", proj(closing)).status).toBe("done");
    expect(evaluateRule("project.invoices_paid", proj(closing))).toEqual({ status: "pending", detail: "1000.00 € por pagar" });
    expect(evaluateRule("project.no_overdue", proj(closing))).toEqual({ status: "pending", detail: "1 vencida(s)" });
    expect(evaluateRule("project.completed", proj(closing)).status).toBe("done");
  });

  it("mês anterior atravessa o ano", () => {
    expect(previousMonthStart("2026-01-15")).toBe("2025-12-01");
    expect(previousMonthStart("2026-10-15")).toBe("2026-09-01");
  });
});

describe("transição de estado (engine)", () => {
  const now = new Date("2026-10-01T10:00:00Z");
  const pending: ItemState = { status: "pending", source: null, detail: null, completedAt: null, completedBy: null };
  const auto = { kind: "auto" as const, ruleKey: "deal.max_price", appliesWhen: null };

  it("automático fica concluído com quem e quando, e volta a pendente se o dado desaparecer", () => {
    const d = nextItemState(auto, pending, deal(readyDeal), now, "u1");
    expect(d).toMatchObject({ status: "done", source: "auto", completedAt: now, completedBy: "u1" });
    const back = nextItemState(auto, d, deal(freshLead), now, "u2");
    expect(back).toMatchObject({ status: "pending", source: "auto", completedAt: null, completedBy: null });
  });

  it("não aplicável manual mantém-se enquanto a regra é falsa, e passa a concluído quando fica verdadeira", () => {
    const na: ItemState = { ...pending, status: "not_applicable", source: "manual" };
    expect(nextItemState(auto, na, deal(freshLead), now, "u1")).toBe(na);
    expect(nextItemState(auto, na, deal(readyDeal), now, "u1").status).toBe("done");
  });

  it("condição de contexto falsa → N/A por contexto; verdadeira de novo → pendente e reavaliado", () => {
    const spec = { kind: "auto" as const, ruleKey: "doc:Licença de utilização", appliesWhen: "needs_licenca" };
    const old = deal({ ...readyDeal, property: { ...readyDeal.property, constructionYear: 1940 } });
    const na = nextItemState(spec, pending, old, now, "u1");
    expect(na).toMatchObject({ status: "not_applicable", source: "context" });
    const again = nextItemState(spec, na, deal(readyDeal), now, "u1");
    expect(again.status).toBe("pending");
  });

  it("manual concluído não é tocado pela sincronização", () => {
    const manual = { kind: "manual" as const, ruleKey: null, appliesWhen: null };
    const doneManual: ItemState = { status: "done", source: "manual", detail: null, completedAt: now, completedBy: "u1" };
    expect(nextItemState(manual, doneManual, deal(freshLead), now, "u2")).toBe(doneManual);
  });

  it("progresso ignora os não aplicáveis", () => {
    expect(summarize([{ status: "done" }, { status: "pending" }, { status: "not_applicable" }, { status: "done" }])).toEqual({ done: 2, total: 3, progress: 2 / 3 });
    expect(summarize([])).toEqual({ done: 0, total: 0, progress: 0 });
  });
});

describe("templates", () => {
  it("códigos únicos, regras e condições conhecidas, dependências existentes", () => {
    for (const t of CHECKLIST_TEMPLATES) {
      const codes = new Set<string>();
      for (const item of t.items) {
        expect(codes.has(item.code), `${t.code}: ${item.code} duplicado`).toBe(false);
        codes.add(item.code);
        if (item.kind === "auto") {
          expect(item.ruleKey, `${item.code} sem regra`).toBeTruthy();
          if (!item.ruleKey!.startsWith("doc:")) expect(KNOWN_RULE_KEYS, `${item.code}: regra ${item.ruleKey}`).toContain(item.ruleKey);
        }
        if (item.appliesWhen) expect(KNOWN_CONDITION_KEYS).toContain(item.appliesWhen);
        for (const g of item.gates ?? []) expect(g).toMatch(/^(hard|warn):/);
      }
      for (const item of t.items) if (item.dependsOn) expect(codes.has(item.dependsOn), `${item.code} depende de ${item.dependsOn}`).toBe(true);
    }
  });
});
