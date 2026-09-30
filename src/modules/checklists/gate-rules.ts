/**
 * Portas do processo (puro, sem base de dados). Que porta uma transição
 * aciona, e como se descreve o que falta. A avaliação dos itens está em
 * `queries.getGateCheck`; a sincronização + avaliação em `gates.ts`.
 *
 * Portas: proposal:generate · deal:stage:proposta · deal:stage:compra ·
 * project:em_curso · project:concluida. "hard" bloqueia, "warn" avisa.
 */

export type GateMissing = { label: string; linkPath: string | null; isRequired: boolean };

/** Porta de uma mudança de fase do negócio; só ao avançar no pipeline. */
export function gateForStage(from: { sort: number }, to: { name: string; sort: number; isPurchase: boolean }): string | null {
  if (to.sort <= from.sort) return null;
  if (to.isPurchase) return "deal:stage:compra";
  if (to.name.trim().toLowerCase().startsWith("proposta")) return "deal:stage:proposta";
  return null;
}

/** Porta de uma mudança de estado da obra. */
export function gateForProjectStatus(status: string): string | null {
  if (status === "em_curso") return "project:em_curso";
  if (status === "concluida") return "project:concluida";
  return null;
}

/** "Falta: Business Plan com cenário ativo, Preço máximo definido." */
export function missingSentence(items: GateMissing[], prefix = "Falta"): string {
  if (items.length === 0) return "";
  return `${prefix}: ${items.map((i) => i.label).join(", ")}.`;
}
