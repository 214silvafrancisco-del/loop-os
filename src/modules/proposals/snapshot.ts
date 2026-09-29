/**
 * Dados que entram na proposta. Guardados em `proposals.data_snapshot` para
 * o PDF poder ser reproduzido mais tarde, mesmo que o negócio mude.
 */
export type ProposalSnapshot = {
  number: string;
  versionNo: number;
  date: string; // YYYY-MM-DD
  company: { name: string; nif: string | null; address: string | null; signature: string };
  property: {
    ref: string;
    title: string; // "T2 · Benfica"
    addressLine: string;
    postalCode: string | null;
    parish: string | null;
    municipality: string | null;
    typology: string | null;
    grossArea: number | null;
    floor: string | null;
    matrixArticle: string | null;
    fraction: string | null;
  };
  recipient: { name: string | null; company: string | null } | null;
  offer: {
    price: number;
    deadlineDays: number | null;
    validityDays: number | null;
    conditions: string | null;
    observations: string | null;
  };
};

const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" });

export function formatEur(v: number) {
  return eur.format(v);
}
export function formatLongDate(iso: string) {
  return dateFmt.format(new Date(iso + "T00:00:00"));
}

/** Valor por extenso simplificado não é necessário: WhatsApp e PDF usam o formato numérico. */

/** Substitui {{placeholders}} no template de WhatsApp. */
export function renderWhatsapp(template: string, s: ProposalSnapshot): string {
  const map: Record<string, string> = {
    morada: [s.property.addressLine, s.property.parish].filter(Boolean).join(", "),
    imovel: s.property.title,
    ref: s.property.ref,
    valor: formatEur(s.offer.price),
    prazo: s.offer.deadlineDays ? `${s.offer.deadlineDays} dias` : "a combinar",
    validade: s.offer.validityDays ? `${s.offer.validityDays} dias` : "a combinar",
    condicoes: s.offer.conditions ?? "",
    observacoes: s.offer.observations ?? "",
    data: formatLongDate(s.date),
    numero: s.number,
    empresa: s.company.name,
    destinatario: s.recipient?.name ?? "",
  };
  return (
    template
      // Blocos condicionais: {{#chave}}…{{/chave}} só aparece se a chave tiver valor.
      .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k: string, inner: string) => (map[k] ? inner : ""))
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => map[k] ?? "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export const DEFAULT_WHATSAPP_TEMPLATE = `Boa tarde{{#destinatario}} {{destinatario}}{{/destinatario}},

Na sequência da visita ao {{imovel}} ({{morada}}), a {{empresa}} apresenta a seguinte proposta de aquisição:

• Valor: *{{valor}}*
• Escritura: {{prazo}}
• Validade da proposta: {{validade}}
{{condicoes}}

{{observacoes}}

Ficamos a aguardar. Obrigado!
{{empresa}}`;

export const DEFAULT_CONDITIONS = `Proposta sujeita à verificação da documentação do imóvel (caderneta predial, certidão permanente, licença de utilização e certificado energético).
Pagamento do sinal na assinatura do CPCV e do remanescente na escritura.
Imóvel livre de ónus, encargos e ocupantes na data da escritura.`;
