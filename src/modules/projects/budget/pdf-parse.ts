/**
 * Orçamento em PDF → árvore de artigos, por regras (sem IA), como a leitura
 * de faturas. Funciona com PDFs com texto (exportados do Excel ou de software
 * de orçamentos); digitalizações sem texto não têm linhas e devolvem vazio.
 *
 * Linha de artigo típica: "1.2 Demolição de paredes m2 45,00 12,50 562,50"
 * (código, descrição, unidade, quantidade, preço unitário, total). Capítulo:
 * "1 Demolições" (código sem valores, ou só com o total). Linhas sem código
 * nem números continuam a descrição anterior. Testado em pdf-parse.test.ts.
 */
import type { ImportedNode } from "./tree";

export type BudgetHeader = { name: string | null; nif: string | null; phone: string | null; email: string | null };

export type ParsedBudgetPdf = {
  tree: ImportedNode[];
  total: number;
  /** Artigos lidos (folhas). */
  items: number;
  /** Linhas com números que não consegui interpretar. */
  skipped: number;
  /** Avisos por artigo: total que não bate, sem unitário, sem código. */
  doubts: string[];
  header: BudgetHeader;
};

const UNITS = ["m2", "m²", "m3", "m³", "ml", "m", "un", "un.", "uni", "unid", "unid.", "vg", "v.g.", "kg", "h", "hr", "dia", "dias", "cj", "cjt", "conj", "pç", "pc", "par", "l", "lt", "ton", "t", "mês", "mes", "sem", "lote", "ud", "pt"];
const UNIT_SET = new Set(UNITS.map((u) => u.toLowerCase()));
const CODE_RE = /^(\d{1,3}(?:\.\d{1,3})*)\.?$/;
const NUM_RE = /^-?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,\d{1,4})?$|^-?\d+(?:\.\d{1,4})?$/;

/** "1.234,56" → 1234.56; "1234.5" → 1234.5. */
export function parsePtNumber(s: string): number | null {
  const t = s.replace(/\s/g, "").replace(/€/g, "");
  if (!NUM_RE.test(t)) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : t.split(".").length > 2 ? Number(t.replace(/\./g, "")) : Number(t);
  return Number.isFinite(n) ? n : null;
}

const isNumTok = (t: string) => parsePtNumber(t) !== null;
const isUnitTok = (t: string) => UNIT_SET.has(t.toLowerCase().replace(/[()]/g, ""));
const r2 = (n: number) => Math.round(n * 100) / 100;

type Line = { kind: "chapter"; code: string | null; description: string } | { kind: "item"; code: string | null; description: string; unit: string | null; quantity: number | null; unitPrice: number | null; total: number | null } | { kind: "text"; description: string } | { kind: "skip" };

const NOISE_RE = /^(p[áa]gina|page|total|subtotal|sub-total|iva|valor|descri[çc][ãa]o|artigo|c[óo]digo|quant|qtd|un\.?|unid|pre[çc]o|unit[áa]rio|or[çc]amento|mapa de quantidades)\b/i;

export function classifyLine(raw: string): Line {
  const line = raw.replace(/\s+/g, " ").trim();
  if (!line) return { kind: "skip" };
  if (NOISE_RE.test(line) && !/^\d/.test(line)) return { kind: "skip" };
  const tokens = line.split(" ");
  // Código no início
  let code: string | null = null;
  if (CODE_RE.test(tokens[0]!)) {
    code = tokens[0]!.replace(/\.$/, "");
    tokens.shift();
  }
  // Números no fim (até 3) e unidade antes deles
  const nums: number[] = [];
  while (tokens.length && nums.length < 3 && isNumTok(tokens[tokens.length - 1]!)) {
    nums.unshift(parsePtNumber(tokens.pop()!)!);
  }
  let unit: string | null = null;
  if (tokens.length && isUnitTok(tokens[tokens.length - 1]!)) unit = tokens.pop()!.replace(/[()]/g, "");
  const description = tokens.join(" ").replace(/^[-–:.)]+\s*/, "").trim();

  if (nums.length === 0 && !unit) {
    if (code) return description ? { kind: "chapter", code, description } : { kind: "skip" };
    return description.length > 2 ? { kind: "text", description } : { kind: "skip" };
  }
  if (nums.length === 1 && !unit && code && description) {
    // "1 Demolições 1.250,00": capítulo com total
    return { kind: "chapter", code, description };
  }
  if (!description && !code) return { kind: "skip" };
  let quantity: number | null = null;
  let unitPrice: number | null = null;
  let total: number | null = null;
  if (nums.length === 3) [quantity, unitPrice, total] = nums as [number, number, number];
  else if (nums.length === 2) {
    const [a, b] = nums as [number, number];
    // Com unidade: qtd + unitário (total = produto). Sem unidade: unitário + total.
    if (unit) [quantity, unitPrice] = [a, b];
    else [unitPrice, total] = [a, b];
  } else if (nums.length === 1) {
    if (unit) quantity = nums[0]!;
    else total = nums[0]!;
  }
  return { kind: "item", code, description: description || `Artigo ${code ?? ""}`.trim(), unit, quantity, unitPrice, total };
}

/** Cabeçalho do fornecedor: nome (primeira linha com letras), NIF, telefone, email. */
export function parseBudgetHeader(text: string): BudgetHeader {
  const head = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 40);
  const joined = head.join("\n");
  const nif = joined.match(/\b(?:NIF|NIPC|Contribuinte|N\.?º?\s*Contrib\w*)[:\s.]*(\d{3}\s?\d{3}\s?\d{3})\b/i)?.[1]?.replace(/\s/g, "") ?? joined.match(/\b([5123]\d{8})\b/)?.[1] ?? null;
  const email = joined.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]?.toLowerCase() ?? null;
  const phone = joined.match(/(?:\+351\s?)?(?:9\d{2}|2\d{2})[\s.]?\d{3}[\s.]?\d{3}\b/)?.[0]?.replace(/[\s.]/g, " ").trim() ?? null;
  const name =
    head.find((l) => /[A-Za-zÀ-ÿ]{3,}/.test(l) && !/or[çc]amento|mapa de quantidades|proposta|cliente|obra|data|p[áa]gina|@|nif|telef|telem|tel\.|morada|rua\b|av\.|email/i.test(l) && !/^\d/.test(l) && l.length <= 80) ?? null;
  return { name, nif, phone, email };
}

/** Texto do PDF → árvore. */
export function parseBudgetText(text: string): ParsedBudgetPdf {
  const lines = text.split(/\r?\n/);
  const root: ImportedNode[] = [];
  const stack: { code: string; node: ImportedNode }[] = [];
  const doubts: string[] = [];
  let skipped = 0;
  let items = 0;
  let last: ImportedNode | null = null;
  let autoChapter = 0;
  let autoItem = 0;

  const parentFor = (code: string | null): ImportedNode[] => {
    if (!code) return stack.length ? stack[stack.length - 1]!.node.children : root;
    const parentCode = code.includes(".") ? code.slice(0, code.lastIndexOf(".")) : null;
    while (stack.length && !(parentCode && (stack[stack.length - 1]!.code === parentCode || parentCode.startsWith(stack[stack.length - 1]!.code + ".")))) stack.pop();
    return stack.length ? stack[stack.length - 1]!.node.children : root;
  };

  for (const raw of lines) {
    let l = classifyLine(raw);
    if (l.kind === "skip") continue;
    if (l.kind === "text") {
      if (last) last.description = `${last.description} ${l.description}`.trim();
      continue;
    }
    if (l.kind === "chapter") {
      const code = l.code ?? String(++autoChapter);
      const node: ImportedNode = { code, description: l.description, quantity: null, unit: null, unitPrice: null, children: [] };
      parentFor(l.code).push(node);
      stack.push({ code, node });
      last = node;
      continue;
    }
    // item
    let { quantity, unitPrice } = l;
    const { total } = l;
    // Artigo partido em duas linhas: "2.2 Reboco e estanhado" / "em paredes novas m2 60,00 20,00 1.200,00".
    const pend = stack[stack.length - 1];
    if (!l.code && pend && last === pend.node && pend.node.children.length === 0 && pend.code.includes(".")) {
      stack.pop();
      const parentList = parentFor(pend.code);
      const idx = parentList.indexOf(pend.node);
      if (idx >= 0) parentList.splice(idx, 1);
      l = { ...l, code: pend.code, description: `${pend.node.description} ${l.description}`.trim() };
    }
    if (quantity !== null && unitPrice !== null && total === null && l.unit) {
      doubts.push(`${l.code ?? l.description.slice(0, 30)}: só 2 valores, assumi quantidade × unitário`);
    }
    if (quantity !== null && unitPrice !== null && total !== null && Math.abs(quantity * unitPrice - total) > Math.max(1, total * 0.01)) {
      doubts.push(`${l.code ?? l.description.slice(0, 30)}: ${quantity} × ${unitPrice} ≠ ${total}`);
    }
    if (unitPrice === null && total !== null) {
      if (quantity && quantity > 0) unitPrice = r2(total / quantity);
      else {
        quantity = 1;
        unitPrice = total;
      }
    }
    if (unitPrice === null) {
      doubts.push(`${l.code ?? l.description.slice(0, 30)}: sem preço unitário`);
      skipped++;
      continue;
    }
    if (quantity === null) quantity = 1;
    let code = l.code;
    if (!code) {
      const parent = stack[stack.length - 1];
      code = parent ? `${parent.code}.${++autoItem}` : String(++autoChapter);
      doubts.push(`${l.description.slice(0, 30)}: sem código (atribuído ${code})`);
    }
    const node: ImportedNode = { code, description: l.description, quantity, unit: l.unit, unitPrice, children: [] };
    parentFor(l.code ?? code).push(node);
    last = node;
    items++;
  }

  const sum = (nodes: ImportedNode[]): number => nodes.reduce((a, n) => a + (n.children.length ? sum(n.children) : (n.quantity ?? 0) * (n.unitPrice ?? 0)), 0);
  // Capítulos sem artigos não contam.
  const prune = (nodes: ImportedNode[]): ImportedNode[] => nodes.filter((n) => n.unitPrice !== null || (n.children = prune(n.children)).length > 0);
  const tree = prune(root);
  return { tree, total: r2(sum(tree)), items, skipped, doubts, header: parseBudgetHeader(text) };
}
