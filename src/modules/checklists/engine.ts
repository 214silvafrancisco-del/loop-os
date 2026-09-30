/**
 * Transição de estado de um item (puro, sem base de dados). A sincronização
 * (`sync.ts`) carrega o contexto, chama isto por item e grava só as diferenças.
 *
 * Regras:
 *  - condição de contexto falsa → "não aplicável" (fonte context); volta a
 *    pendente quando a condição passa a verdadeira;
 *  - item automático segue a regra: pode ficar concluído e voltar a pendente
 *    (itens "vivos"); nunca se marca à mão;
 *  - "não aplicável" manual mantém-se, exceto se a regra automática ficar
 *    verdadeira (o dado existe, logo está concluído);
 *  - item manual só muda por ação do utilizador (ou por contexto).
 */
import { evaluateCondition, evaluateRule, type RuleContext } from "./rules";
import type { ChecklistItemStatus } from "./schema";

export type ItemSource = "auto" | "manual" | "context";

export type ItemState = {
  status: ChecklistItemStatus;
  source: ItemSource | null;
  detail: string | null;
  completedAt: Date | null;
  completedBy: string | null;
};

export type ItemSpec = {
  kind: "auto" | "manual";
  ruleKey: string | null;
  appliesWhen: string | null;
};

const cleared = (status: ChecklistItemStatus, source: ItemSource | null, detail: string | null = null): ItemState => ({
  status,
  source,
  detail,
  completedAt: null,
  completedBy: null,
});

export function nextItemState(spec: ItemSpec, cur: ItemState, rc: RuleContext, now: Date, userId: string | null): ItemState {
  const applies = spec.appliesWhen ? evaluateCondition(spec.appliesWhen, rc) : true;

  if (!applies) {
    if (cur.status === "not_applicable") return cur;
    return cleared("not_applicable", "context");
  }

  // Deixou de ser N/A por contexto: recomeça como pendente.
  const base: ItemState = cur.status === "not_applicable" && cur.source === "context" ? cleared("pending", null) : cur;

  if (spec.kind === "manual" || !spec.ruleKey) return base;

  const r = evaluateRule(spec.ruleKey, rc);
  const detail = r.detail ?? null;

  if (r.status === "done") {
    if (base.status === "done") return base.detail === detail ? base : { ...base, detail };
    return { status: "done", source: "auto", detail, completedAt: now, completedBy: userId };
  }
  if (r.status === "na") {
    if (base.status === "not_applicable") return base;
    return cleared("not_applicable", "context", detail);
  }
  // pendente
  if (base.status === "not_applicable" && base.source === "manual") return base;
  if (base.status === "done" && base.source === "auto") return cleared("pending", "auto", detail);
  return base.detail === detail && base.status === "pending" ? base : { ...base, status: "pending", detail };
}

export function sameState(a: ItemState, b: ItemState): boolean {
  return (
    a.status === b.status &&
    a.source === b.source &&
    a.detail === b.detail &&
    (a.completedAt?.getTime() ?? null) === (b.completedAt?.getTime() ?? null) &&
    a.completedBy === b.completedBy
  );
}

/** Progresso sobre os itens aplicáveis (exclui "não aplicável"). */
export function summarize(items: { status: ChecklistItemStatus }[]): { done: number; total: number; progress: number } {
  const applicable = items.filter((i) => i.status !== "not_applicable");
  const done = applicable.filter((i) => i.status === "done").length;
  const total = applicable.length;
  return { done, total, progress: total === 0 ? 0 : done / total };
}
