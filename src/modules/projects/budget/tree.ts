/**
 * Lógica pura do orçamento: árvore, códigos, totais e parser do mapa de
 * quantidades em Excel. Sem I/O; testada contra o Orçamento Amadora.
 */

export type BudgetNode = {
  /** id da BD ou id temporário (`tmp-…`) no cliente. */
  id: string;
  parentId: string | null;
  sort: number;
  description: string;
  categoryId: string | null;
  supplierId: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  vatRate: number;
  notes: string | null;
};

export type BudgetTotals = {
  /** Orçamentado sem IVA por nó (folhas: qty × preço; pais: soma). */
  byNode: Record<string, number>;
  /** IVA por nó. */
  vatByNode: Record<string, number>;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  bySupplier: { supplierId: string | null; net: number }[];
  byChapter: { id: string; description: string; net: number }[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function childrenOf(nodes: BudgetNode[], parentId: string | null): BudgetNode[] {
  return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.sort - b.sort);
}

export function isLeaf(nodes: BudgetNode[], id: string): boolean {
  return !nodes.some((n) => n.parentId === id);
}

export function depthOf(nodes: BudgetNode[], id: string): number {
  let d = 0;
  let cur = nodes.find((n) => n.id === id);
  while (cur?.parentId) {
    d++;
    cur = nodes.find((n) => n.id === cur!.parentId);
  }
  return d;
}

/** Códigos por posição: 1, 1.1, 1.1.1 … */
export function assignCodes(nodes: BudgetNode[]): Record<string, string> {
  const codes: Record<string, string> = {};
  const walk = (parentId: string | null, prefix: string) => {
    childrenOf(nodes, parentId).forEach((n, i) => {
      const code = prefix ? `${prefix}.${i + 1}` : String(i + 1);
      codes[n.id] = code;
      walk(n.id, code);
    });
  };
  walk(null, "");
  return codes;
}

/** Ordem de apresentação (pré-ordem), com a profundidade de cada nó. */
export function flatten(nodes: BudgetNode[]): { node: BudgetNode; depth: number }[] {
  const out: { node: BudgetNode; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const n of childrenOf(nodes, parentId)) {
      out.push({ node: n, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function leafAmount(n: BudgetNode): number {
  return r2((n.quantity ?? 0) * (n.unitPrice ?? 0));
}

export function computeTotals(nodes: BudgetNode[]): BudgetTotals {
  const byNode: Record<string, number> = {};
  const vatByNode: Record<string, number> = {};
  const bySupplier = new Map<string | null, number>();

  const compute = (id: string): { net: number; vat: number } => {
    const kids = childrenOf(nodes, id);
    const node = nodes.find((n) => n.id === id)!;
    let net = 0;
    let vat = 0;
    if (kids.length === 0) {
      net = leafAmount(node);
      vat = r2(net * node.vatRate);
      bySupplier.set(node.supplierId, r2((bySupplier.get(node.supplierId) ?? 0) + net));
    } else {
      for (const k of kids) {
        const c = compute(k.id);
        net += c.net;
        vat += c.vat;
      }
      net = r2(net);
      vat = r2(vat);
    }
    byNode[id] = net;
    vatByNode[id] = vat;
    return { net, vat };
  };

  let totalNet = 0;
  let totalVat = 0;
  const byChapter: BudgetTotals["byChapter"] = [];
  for (const root of childrenOf(nodes, null)) {
    const c = compute(root.id);
    totalNet += c.net;
    totalVat += c.vat;
    byChapter.push({ id: root.id, description: root.description, net: c.net });
  }
  totalNet = r2(totalNet);
  totalVat = r2(totalVat);
  return {
    byNode,
    vatByNode,
    totalNet,
    totalVat,
    totalGross: r2(totalNet + totalVat),
    bySupplier: [...bySupplier.entries()].map(([supplierId, net]) => ({ supplierId, net })).sort((a, b) => b.net - a.net),
    byChapter,
  };
}

/* ── Parser do mapa de quantidades (folha "Orçamento") ───────────────────── */

export type ParsedRow = (string | number | null)[];

export type ImportedNode = {
  code: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  children: ImportedNode[];
};

const CODE_RE = /^\d+(\.\d+)*$/;

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Lê linhas do Excel no formato "Artigo | Referência | Qtd | un | Unitário | Total".
 * Detecta a linha de cabeçalho pelas palavras "Artigo" e "Qtd"; ignora linhas
 * de totais e notas. Códigos "1" → capítulo, "1.1" → subcapítulo, "1.1.1" → artigo.
 */
export function parseBudgetSheet(rows: ParsedRow[]): { tree: ImportedNode[]; total: number; skipped: number } {
  // Encontrar cabeçalho e colunas
  let headerIdx = -1;
  let col = { code: 0, desc: 1, qty: 2, unit: 3, price: 4 };
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] ?? []).map((c) => String(c ?? "").trim().toLowerCase());
    const codeIdx = cells.findIndex((c) => c === "artigo" || c === "código" || c === "codigo");
    const qtyIdx = cells.findIndex((c) => c.startsWith("qtd") || c === "quantidade");
    if (codeIdx >= 0 && qtyIdx >= 0) {
      headerIdx = i;
      const descIdx = cells.findIndex((c, k) => k > codeIdx && (c.startsWith("refer") || c.startsWith("descri") || c.startsWith("designa")));
      const unitIdx = cells.findIndex((c) => c === "un" || c === "un." || c === "unidade");
      const priceIdx = cells.findIndex((c) => c.startsWith("unit") || c.startsWith("preço") || c.startsWith("preco"));
      col = {
        code: codeIdx,
        desc: descIdx >= 0 ? descIdx : codeIdx + 1,
        qty: qtyIdx,
        unit: unitIdx >= 0 ? unitIdx : qtyIdx + 1,
        price: priceIdx >= 0 ? priceIdx : qtyIdx + 2,
      };
      break;
    }
  }

  const roots: ImportedNode[] = [];
  const byCode = new Map<string, ImportedNode>();
  let skipped = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rawCode = row[col.code];
    const code = rawCode === null || rawCode === undefined ? "" : String(rawCode).trim();
    const desc = String(row[col.desc] ?? "").trim();
    if (!code || !CODE_RE.test(code) || !desc) {
      if (desc && !/^total/i.test(desc) && code && !CODE_RE.test(code)) skipped++;
      continue;
    }
    if (/^total/i.test(desc)) continue;

    const node: ImportedNode = {
      code,
      description: desc,
      quantity: toNum(row[col.qty]),
      unit: row[col.unit] ? String(row[col.unit]).trim() : null,
      unitPrice: toNum(row[col.price]),
      children: [],
    };
    const parentCode = code.includes(".") ? code.slice(0, code.lastIndexOf(".")) : null;
    const parent = parentCode ? byCode.get(parentCode) : undefined;
    const container = parent ? parent.children : roots;

    // Código repetido: se o anterior era uma linha "vazia" (nota sem valores nem
    // filhos, como "1 | Os valores estão excluídos de IVA"), é substituído;
    // senão (ex.: "7.1.1" duas vezes com valores) o novo recebe um sufixo.
    const existing = byCode.get(code);
    let key = code;
    if (existing && existing.children.length === 0 && existing.quantity === null && existing.unitPrice === null) {
      const idx = container.indexOf(existing);
      if (idx >= 0) container.splice(idx, 1);
      skipped++;
    } else {
      while (byCode.has(key)) key += "b";
    }
    byCode.set(key, node);
    container.push(node);
  }

  const sum = (n: ImportedNode): number =>
    n.children.length ? n.children.reduce((a, c) => a + sum(c), 0) : (n.quantity ?? 0) * (n.unitPrice ?? 0);
  const total = r2(roots.reduce((a, n) => a + sum(n), 0));
  return { tree: roots, total, skipped };
}

/** Converte a árvore importada em nós planos com ids temporários. */
export function importedToNodes(tree: ImportedNode[], startSort = 0, vatRate = 0.23): BudgetNode[] {
  const out: BudgetNode[] = [];
  let counter = 0;
  const walk = (items: ImportedNode[], parentId: string | null, base: number) => {
    items.forEach((it, i) => {
      const id = `tmp-import-${++counter}`;
      const leaf = it.children.length === 0;
      out.push({
        id,
        parentId,
        sort: base + i + 1,
        description: it.description,
        categoryId: null,
        supplierId: null,
        quantity: leaf ? it.quantity : null,
        unit: leaf ? it.unit : null,
        unitPrice: leaf ? it.unitPrice : null,
        vatRate,
        notes: null,
      });
      walk(it.children, id, 0);
    });
  };
  walk(tree, null, startSort);
  return out;
}
