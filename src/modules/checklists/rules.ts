/**
 * Regras automáticas e condições de contexto das checklists. Código puro,
 * sem base de dados: recebe um contexto já carregado (`context.ts`) e devolve
 * concluído / pendente / não aplicável. Testado em `rules.test.ts`.
 */
import { normalizeText } from "@/core/lib/format";

export type RuleStatus = "done" | "pending" | "na";
export type RuleResult = { status: RuleStatus; detail?: string };

export type DealContext = {
  deal: {
    name: string | null;
    askingPrice: number | null;
    sourceChannelId: string | null;
    sourceChannelName: string | null;
    sourceContactId: string | null;
    contactPhone: string | null;
    ownerUserId: string | null;
    nextAction: string | null;
    nextActionDate: string | null;
    maxPrice: number | null;
    finalPrice: number | null;
    deedDate: string | null;
    cpcvDate: string | null;
    status: "active" | "excluded" | "sold";
    sourceCommissionPct: number | null;
    stageIsPurchase: boolean;
  };
  property: {
    addressLine: string;
    parish: string | null;
    municipality: string | null;
    typology: string | null;
    grossArea: number | null;
    floor: string | null;
    constructionYear: number | null;
    condition: string | null;
  };
  /** Nomes normalizados das categorias com documentos ativos no imóvel. */
  docCategories: string[];
  comparablesCount: number;
  activeScenario: { ltvPct: number } | null;
  proposals: { count: number; sent: number; decided: number };
  /** YYYY-MM-DD */
  today: string;
};

export type ProjectContext = {
  project: {
    managerUserId: string | null;
    plannedStart: string | null;
    plannedEnd: string | null;
    actualStart: string | null;
    actualEnd: string | null;
    status: "planeamento" | "a_iniciar" | "em_curso" | "pausada" | "concluida" | "cancelada";
  };
  budget: { lineCount: number; total: number; chaptersWithCategory: number; chapterCount: number; chaptersWithSupplier: number; leafCount: number };
  docCategories: string[];
  /** Fornecedores da obra com o estado dos seus autos. */
  suppliers: {
    id: string;
    name: string;
    controlMode: "autos" | "fatura";
    budgeted: number;
    closedCount: number;
    draftCount: number;
    /** Primeiro dia do mês do último auto fechado deste fornecedor. */
    lastClosedMonth: string | null;
    lastClosedCumulative: number;
  }[];
  invoices: { count: number; total: number; paid: number; overdueUnpaid: number };
  paymentsCount: number;
  /** YYYY-MM-DD */
  today: string;
};

export type RuleContext = { entityType: "deal"; ctx: DealContext } | { entityType: "project"; ctx: ProjectContext };

const done = (detail?: string): RuleResult => ({ status: "done", detail });
const pending = (detail?: string): RuleResult => ({ status: "pending", detail });
const has = (v: unknown) => v !== null && v !== undefined && v !== "";
const pos = (v: number | null) => v !== null && v > 0;
const countOf = (n: number, of: number) => `${n} de ${of}`;

function hasDoc(categories: string[], name: string) {
  return categories.includes(normalizeText(name));
}

/** Mês anterior ao de `today`, como primeiro dia (YYYY-MM-01). */
export function previousMonthStart(today: string): string {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 10);
}

const DEAL_RULES: Record<string, (c: DealContext) => RuleResult> = {
  "deal.identified": (c) => (has(c.deal.name) || (has(c.property.typology) && has(c.property.parish)) ? done() : pending()),
  "deal.address_complete": (c) => {
    const a = c.property;
    if (/por confirmar/i.test(a.addressLine)) return pending("morada por confirmar");
    const missing = [!has(a.parish) && "freguesia", !has(a.municipality) && "concelho"].filter(Boolean) as string[];
    return a.addressLine.trim().length >= 3 && missing.length === 0 ? done() : pending(missing.length ? `falta ${missing.join(" e ")}` : undefined);
  },
  "deal.asking_price": (c) => (pos(c.deal.askingPrice) ? done() : pending()),
  "deal.source": (c) => (has(c.deal.sourceChannelId) ? done() : pending()),
  "deal.contact": (c) => {
    if (!has(c.deal.sourceContactId)) return pending();
    return has(c.deal.contactPhone) ? done() : pending("contacto sem telefone");
  },
  "deal.owner": (c) => (has(c.deal.ownerUserId) ? done() : pending()),
  "deal.next_action": (c) => (has(c.deal.nextAction) && has(c.deal.nextActionDate) ? done() : pending()),
  "deal.property_data": (c) => {
    const p = c.property;
    const fields = [pos(p.grossArea), has(p.typology), has(p.floor), has(p.constructionYear), has(p.condition)];
    const n = fields.filter(Boolean).length;
    return n === fields.length ? done() : pending(countOf(n, fields.length));
  },
  "deal.comparables": (c) => (c.comparablesCount >= 3 ? done(String(c.comparablesCount)) : pending(countOf(c.comparablesCount, 3))),
  "deal.business_plan": (c) => (c.activeScenario ? done() : pending()),
  "deal.max_price": (c) => (pos(c.deal.maxPrice) ? done() : pending()),
  "deal.proposal_generated": (c) => (c.proposals.count > 0 ? done(String(c.proposals.count)) : pending()),
  "deal.proposal_sent": (c) => (c.proposals.sent > 0 ? done() : pending()),
  "deal.outcome": (c) => (c.proposals.decided > 0 || c.deal.status === "excluded" ? done() : pending()),
  "deal.purchase_terms": (c) => {
    const missing = [!pos(c.deal.finalPrice) && "valor final", !has(c.deal.deedDate) && "escritura"].filter(Boolean) as string[];
    return missing.length === 0 ? done() : pending(`falta ${missing.join(" e ")}`);
  },
  "deal.deed_done": (c) => {
    if (!has(c.deal.deedDate)) return pending("sem data de escritura");
    return c.deal.deedDate! <= c.today ? done(c.deal.deedDate!) : pending(`escritura marcada para ${c.deal.deedDate}`);
  },
};

const PROJECT_RULES: Record<string, (c: ProjectContext) => RuleResult> = {
  "project.manager": (c) => (has(c.project.managerUserId) ? done() : pending()),
  "project.planned_dates": (c) => (has(c.project.plannedStart) && has(c.project.plannedEnd) ? done() : pending()),
  "project.budget_exists": (c) => (c.budget.lineCount > 0 && c.budget.total > 0 ? done() : pending()),
  "project.budget_suppliers": (c) => {
    const { chapterCount, chaptersWithSupplier } = c.budget;
    if (chapterCount === 0) return pending();
    return chaptersWithSupplier === chapterCount ? done(countOf(chaptersWithSupplier, chapterCount)) : pending(countOf(chaptersWithSupplier, chapterCount));
  },
  "project.started": (c) => (has(c.project.actualStart) || ["em_curso", "pausada", "concluida"].includes(c.project.status) ? done() : pending()),
  "project.first_measurement": (c) => (c.suppliers.some((s) => s.closedCount > 0) ? done() : pending()),
  "project.measurements_current": (c) => {
    // Só fornecedores controlados por autos e com orçamento.
    const byAutos = c.suppliers.filter((s) => s.controlMode === "autos" && s.budgeted > 0);
    if (byAutos.length === 0) return { status: "na" };
    const limit = previousMonthStart(c.today);
    const ok = byAutos.filter((s) => s.lastClosedMonth !== null && s.lastClosedMonth >= limit);
    const detail = `${ok.length} de ${byAutos.length} fornecedor${byAutos.length === 1 ? "" : "es"} em dia`;
    return ok.length === byAutos.length ? done(detail) : pending(detail);
  },
  "project.no_draft_measurements": (c) => {
    const drafts = c.suppliers.reduce((a, s) => a + s.draftCount, 0);
    return drafts === 0 ? done() : pending(`${drafts} em rascunho`);
  },
  "project.invoices_exist": (c) => (c.invoices.count > 0 ? done(String(c.invoices.count)) : pending()),
  "project.payments_exist": (c) => (c.paymentsCount > 0 ? done(String(c.paymentsCount)) : pending()),
  "project.no_overdue": (c) => (c.invoices.overdueUnpaid === 0 ? done() : pending(`${c.invoices.overdueUnpaid} vencida(s)`)),
  "project.measurements_complete": (c) => {
    const byAutos = c.suppliers.filter((s) => s.controlMode === "autos" && s.budgeted > 0);
    if (byAutos.length === 0) return { status: "na" };
    const complete = byAutos.filter((s) => s.lastClosedCumulative >= s.budgeted - 0.01);
    const detail = `${complete.length} de ${byAutos.length} fornecedor${byAutos.length === 1 ? "" : "es"} a 100 %`;
    return complete.length === byAutos.length ? done(detail) : pending(detail);
  },
  "project.invoices_paid": (c) => {
    if (c.invoices.count === 0) return pending("sem faturas");
    const left = Math.max(0, c.invoices.total - c.invoices.paid);
    return left <= 0.01 ? done() : pending(`${left.toFixed(2)} € por pagar`);
  },
  "project.completed": (c) => (c.project.status === "concluida" ? done() : pending()),
};

const CONDITIONS: Record<string, (rc: RuleContext) => boolean> = {
  needs_licenca: (rc) => rc.entityType === "deal" && (rc.ctx.property.constructionYear === null || rc.ctx.property.constructionYear >= 1951),
  has_financing: (rc) => rc.entityType === "deal" && rc.ctx.activeScenario !== null && rc.ctx.activeScenario.ltvPct > 0,
  stage_purchase: (rc) => rc.entityType === "deal" && rc.ctx.deal.stageIsPurchase,
  project_in_progress: (rc) => rc.entityType === "project" && rc.ctx.project.status === "em_curso",
};

/** Avalia uma regra; regra desconhecida fica pendente com nota, nunca rebenta. */
export function evaluateRule(ruleKey: string, rc: RuleContext): RuleResult {
  if (ruleKey.startsWith("doc:")) {
    return hasDoc(rc.ctx.docCategories, ruleKey.slice(4)) ? done() : pending();
  }
  if (rc.entityType === "deal") {
    const fn = DEAL_RULES[ruleKey];
    return fn ? fn(rc.ctx) : pending("regra desconhecida");
  }
  const fn = PROJECT_RULES[ruleKey];
  return fn ? fn(rc.ctx) : pending("regra desconhecida");
}

/** Condição desconhecida = aplica-se (nunca esconde um item por engano). */
export function evaluateCondition(key: string, rc: RuleContext): boolean {
  const fn = CONDITIONS[key];
  return fn ? fn(rc) : true;
}

export const KNOWN_RULE_KEYS = [...Object.keys(DEAL_RULES), ...Object.keys(PROJECT_RULES)];
export const KNOWN_CONDITION_KEYS = Object.keys(CONDITIONS);
