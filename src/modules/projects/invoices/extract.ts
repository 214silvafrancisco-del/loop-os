/**
 * Leitura de faturas por regras (puro, sem I/O): recebe o texto de um PDF e
 * devolve os campos que conseguiu reconhecer. Pensado para faturas
 * portuguesas (FT/FR/FS, "N.º", "Data", "Vencimento", "IVA", "Total", NIF).
 * Não lê digitalizações sem texto: nesse caso o texto vem vazio.
 */

export type ExtractedInvoice = {
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  netAmount: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  total: number | null;
  /** NIFs encontrados, pela ordem em que aparecem (o do fornecedor costuma vir primeiro). */
  nifs: string[];
  /** Campos preenchidos e avisos, para o utilizador saber o que confirmar. */
  found: (keyof Omit<ExtractedInvoice, "found" | "warnings" | "nifs">)[];
  warnings: string[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const VAT_RATES = [0.23, 0.13, 0.06, 0];

/** "1.234,56" | "1 234,56" | "1234.56" | "1234,5" → 1234.56 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/\s|€|EUR/gi, "").trim();
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? r2(n) : null;
}

/** dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd → yyyy-mm-dd */
export function parseDate(raw: string): string | null {
  let m = raw.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    const dd = Number(d), mm = Number(mo);
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
    return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0]!;
  return null;
}

const AMOUNT = String.raw`(-?\d{1,3}(?:[ .]\d{3})*(?:,\d{1,2})?|-?\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR)?`;
const DATE = String.raw`(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}-\d{2}-\d{2})`;

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function allAmounts(text: string, patterns: RegExp[]): number[] {
  const out: number[] = [];
  for (const p of patterns) {
    for (const m of text.matchAll(new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g"))) {
      const n = m[1] ? parseAmount(m[1]) : null;
      if (n !== null) out.push(n);
    }
  }
  return out;
}

export function parseInvoiceText(rawText: string): ExtractedInvoice {
  const text = rawText.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\r/g, "");
  const found: ExtractedInvoice["found"] = [];
  const warnings: string[] = [];

  // Número: "Fatura FT 2026/45", "FT A/123", "Fatura n.º 2026-001", "N.º Documento: FT 1/2024", "Fatura-Recibo FR 12"
  const number = firstMatch(text, [
    /(?:fatura|factura|fatura-recibo|factura-recibo)\s*(?:simplificada)?\s*(?:n\.?[ºo°]?|nº|n\.?|number|no\.?)?\s*[:#]?\s*((?:FT|FR|FS|FA|ND|NC)\s?[A-Z0-9]*[\/\-\s]?\d[\d\/\-\.]*)/i,
    /\b((?:FT|FR|FS)\s?[A-Z0-9]{0,6}[\/\-]\d{1,6}(?:[\/\-]\d{1,6})?)\b/,
    /(?:fatura|factura|fatura-recibo)\s*(?:n\.?[ºo°]|nº|n\.|number|no\.?)\s*[:#]?\s*([A-Z0-9][A-Z0-9\/\-\.]{1,30})/i,
    /(?:n\.?[ºo°]|nº|número)\s*(?:do\s+)?(?:documento|fatura|factura)\s*[:#]?\s*([A-Z0-9][A-Z0-9\/\-\.]{1,30})/i,
    /(?:documento|doc\.?)\s*(?:n\.?[ºo°]|nº)?\s*[:#]\s*([A-Z0-9][A-Z0-9\/\-\.]{1,30})/i,
  ]);
  if (number) found.push("number");

  // Datas
  const dueRaw = firstMatch(text, [new RegExp(String.raw`(?:vencimento|data\s+limite|pagamento\s+at[ée]|due\s+date)\s*[:\-]?\s*` + DATE, "i")]);
  const issueRaw = firstMatch(text, [
    new RegExp(String.raw`(?:data\s+(?:de\s+)?(?:emiss[ãa]o|do\s+documento|da\s+fatura|factura))\s*[:\-]?\s*` + DATE, "i"),
    new RegExp(String.raw`\bdata\s*[:\-]?\s*` + DATE, "i"),
    new RegExp(DATE),
  ]);
  const issueDate = issueRaw ? parseDate(issueRaw) : null;
  const dueDate = dueRaw ? parseDate(dueRaw) : null;
  if (issueDate) found.push("issueDate");
  if (dueDate && dueDate !== issueDate) found.push("dueDate");

  // Valores
  const totals = allAmounts(text, [
    new RegExp(String.raw`(?:total\s+(?:a\s+pagar|geral|do\s+documento|da\s+fatura|c\/?\s*iva|com\s+iva)|valor\s+total|montante\s+total|total)\s*(?:\(?€\)?|EUR)?\s*[:\-]?\s*` + AMOUNT, "i"),
  ]);
  const vats = allAmounts(text, [
    // "IVA 23%" só conta se vier um valor a seguir; "IVA" solto não pode apanhar a taxa.
    new RegExp(String.raw`(?:total\s+(?:de\s+)?iva|valor\s+(?:do\s+)?iva|iva\s*\(\d{1,2}\s*%\)|iva\s+\d{1,2}\s*%|iva(?!\s*\(?\d{1,2}\s*%))\s*(?:\(?€\)?|EUR)?\s*[:\-]?\s*` + AMOUNT + String.raw`(?!\s*%)`, "i"),
  ]);
  const nets = allAmounts(text, [
    new RegExp(String.raw`(?:sub-?total|total\s+s\/?\s*iva|total\s+sem\s+iva|base\s+tribut[áa]vel|incid[êe]ncia|valor\s+l[íi]quido|total\s+l[íi]quido|mercadorias?\s*\/?\s*servi[çc]os)\s*(?:\(?€\)?|EUR)?\s*[:\-]?\s*` + AMOUNT, "i"),
  ]);
  const rateMatch = text.match(/(\d{1,2})\s*%/g)?.map((s) => Number(s.replace(/[^\d]/g, "")) / 100).find((r) => VAT_RATES.includes(r));

  let total: number | null = totals.length ? Math.max(...totals) : null;
  let vatAmount: number | null = vats.length ? vats.find((v) => v > 0) ?? vats[0]! : null;
  let netAmount: number | null = nets.length ? Math.max(...nets) : null;

  // Coerência: com dois valores deduz-se o terceiro; com incoerência, o total manda.
  if (total !== null && netAmount !== null && vatAmount === null) vatAmount = r2(total - netAmount);
  else if (total !== null && vatAmount !== null && netAmount === null) netAmount = r2(total - vatAmount);
  else if (total === null && netAmount !== null && vatAmount !== null) total = r2(netAmount + vatAmount);
  else if (total !== null && netAmount === null && vatAmount === null && rateMatch !== undefined) {
    netAmount = r2(total / (1 + rateMatch));
    vatAmount = r2(total - netAmount);
  }
  if (total !== null && netAmount !== null && vatAmount !== null && Math.abs(netAmount + vatAmount - total) > 0.05) {
    warnings.push("Os valores lidos não batem certo (base + IVA ≠ total). Confirma-os.");
    if (rateMatch !== undefined) {
      netAmount = r2(total / (1 + rateMatch));
      vatAmount = r2(total - netAmount);
    }
  }
  if (netAmount !== null && netAmount < 0) netAmount = null;
  if (total !== null) found.push("total");
  if (netAmount !== null) found.push("netAmount");
  if (vatAmount !== null) found.push("vatAmount");

  let vatRate: number | null = null;
  if (netAmount && vatAmount !== null) {
    const r = vatAmount / netAmount;
    vatRate = VAT_RATES.find((v) => Math.abs(v - r) < 0.011) ?? null;
  }
  if (vatRate === null && rateMatch !== undefined) vatRate = rateMatch;
  if (vatRate !== null) found.push("vatRate");

  // NIFs (9 dígitos, com ou sem "PT")
  const nifs: string[] = [];
  for (const m of text.matchAll(/(?:NIF|NIPC|N\.?I\.?F\.?|contribuinte|VAT)\s*[:\-]?\s*(?:PT\s?)?(\d{3}\s?\d{3}\s?\d{3})\b/gi)) {
    const nif = m[1]!.replace(/\s/g, "");
    if (!nifs.includes(nif)) nifs.push(nif);
  }

  if (!rawText.trim()) warnings.push("O PDF não tem texto legível (digitalização ou fotografia). Preenche os campos à mão.");
  else if (found.length === 0) warnings.push("Não reconheci nenhum campo neste PDF. Preenche os campos à mão.");

  return { number, issueDate, dueDate, netAmount, vatRate, vatAmount, total, nifs, found, warnings };
}
