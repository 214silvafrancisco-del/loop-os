import type { PushPayload } from "./send";

/** Números do dia de uma organização, já contados pelo servidor. */
export type DigestData = {
  /** Ações com data até hoje (inclui as atrasadas). */
  actionsDue: number;
  /** Das anteriores, quantas têm data anterior a hoje. */
  actionsOverdue: number;
  /** Primeira ação por data, para dar contexto ("LH-0007 · Ligar ao vendedor"). */
  firstAction: string | null;
  /** Faturas por pagar que vencem nos próximos 7 dias (inclui as vencidas). */
  invoicesDue: number;
  invoicesOverdue: number;
  /** Total por pagar dessas faturas, com IVA. */
  invoicesAmount: number;
  /** Ações de vendas e de leads com data até hoje. */
  salesActionsDue: number;
};

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

function euros(v: number): string {
  return `${Math.round(v).toLocaleString("pt-PT")} €`;
}

/**
 * Texto do resumo diário. Devolve null quando não há nada a dizer: nesse dia
 * não se envia notificação nenhuma.
 */
export function formatDigest(d: DigestData): PushPayload | null {
  const lines: string[] = [];
  if (d.actionsDue > 0) {
    const today = d.actionsDue - d.actionsOverdue;
    let line =
      today > 0
        ? `${n(today, "ação", "ações")} para hoje${d.actionsOverdue > 0 ? ` e ${n(d.actionsOverdue, "atrasada", "atrasadas")}` : ""}`
        : `${n(d.actionsOverdue, "ação atrasada", "ações atrasadas")}`;
    if (d.firstAction) line += `\nPróxima: ${d.firstAction}`;
    lines.push(line);
  }
  if (d.salesActionsDue > 0) lines.push(`${n(d.salesActionsDue, "ação de venda", "ações de venda")} (vendas e leads) para hoje`);
  if (d.invoicesDue > 0) {
    const soon = d.invoicesDue - d.invoicesOverdue;
    const parts: string[] = [];
    if (soon > 0) parts.push(`${n(soon, "fatura vence", "faturas vencem")} esta semana`);
    if (d.invoicesOverdue > 0) parts.push(`${n(d.invoicesOverdue, "fatura vencida", "faturas vencidas")}`);
    lines.push(`${parts.join(", ")} · ${euros(d.invoicesAmount)} por pagar`);
  }
  if (lines.length === 0) return null;
  return { title: "LOOP OS · Hoje", body: lines.join("\n"), url: "/dashboard", tag: "daily-digest" };
}
