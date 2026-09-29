/** Testes da árvore e do parser com o Orçamento Amadora V1.1.xlsx (total 22 000 € s/ IVA). */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { assignCodes, computeTotals, importedToNodes, parseBudgetSheet, type BudgetNode, type ParsedRow } from "./tree";

function loadFixtureRows(): ParsedRow[] {
  const file = path.join(__dirname, "__fixtures__", "orcamento-amadora.xlsx");
  const wb = XLSX.read(readFileSync(file), { type: "buffer" });
  const sheet = wb.Sheets["Orçamento"] ?? wb.Sheets[wb.SheetNames[1]!]!;
  return XLSX.utils.sheet_to_json<ParsedRow>(sheet, { header: 1, raw: true, defval: null });
}

const node = (p: Partial<BudgetNode> & { id: string; parentId: string | null; sort: number; description: string }): BudgetNode => ({
  categoryId: null,
  supplierId: null,
  quantity: null,
  unit: null,
  unitPrice: null,
  vatRate: 0.23,
  notes: null,
  ...p,
});

describe("árvore do orçamento", () => {
  const nodes: BudgetNode[] = [
    node({ id: "c1", parentId: null, sort: 1, description: "Demolições" }),
    node({ id: "s11", parentId: "c1", sort: 1, description: "Demolições" }),
    node({ id: "a111", parentId: "s11", sort: 1, description: "Demolir parede", quantity: 1, unit: "vg", unitPrice: 3000, supplierId: "emp" }),
    node({ id: "s12", parentId: "c1", sort: 2, description: "Apoio" }),
    node({ id: "a121", parentId: "s12", sort: 1, description: "Roços", quantity: 2, unit: "vg", unitPrice: 1100, supplierId: "emp" }),
    node({ id: "c2", parentId: null, sort: 2, description: "Cozinha" }),
    node({ id: "a21", parentId: "c2", sort: 1, description: "Cerâmico", quantity: 10, unit: "m²", unitPrice: 70, supplierId: "loja", vatRate: 0.06 }),
  ];

  it("códigos por posição", () => {
    const codes = assignCodes(nodes);
    expect(codes.c1).toBe("1");
    expect(codes.s11).toBe("1.1");
    expect(codes.a111).toBe("1.1.1");
    expect(codes.a121).toBe("1.2.1");
    expect(codes.a21).toBe("2.1");
  });

  it("totais por nó, capítulo, fornecedor e IVA", () => {
    const t = computeTotals(nodes);
    expect(t.byNode.a111).toBe(3000);
    expect(t.byNode.s12).toBe(2200);
    expect(t.byNode.c1).toBe(5200);
    expect(t.byNode.c2).toBe(700);
    expect(t.totalNet).toBe(5900);
    expect(t.totalVat).toBeCloseTo(5200 * 0.23 + 700 * 0.06, 2);
    expect(t.byChapter.map((c) => c.net)).toEqual([5200, 700]);
    expect(t.bySupplier.find((s) => s.supplierId === "emp")?.net).toBe(5200);
    expect(t.bySupplier.find((s) => s.supplierId === "loja")?.net).toBe(700);
  });
});

describe("parser do mapa de quantidades (Orçamento Amadora)", () => {
  const rows = loadFixtureRows();
  const parsed = parseBudgetSheet(rows);

  it("total geral 22 000 € e 9 capítulos", () => {
    expect(parsed.total).toBe(22000);
    expect(parsed.tree.length).toBe(9);
    expect(parsed.tree.map((c) => c.code)).toEqual(["1", "2", "3", "4", "5", "6", "7", "9", "10"]);
  });

  it("capítulo 1 com dois subcapítulos e artigos com quantidade/unidade/preço", () => {
    const c1 = parsed.tree[0]!;
    expect(c1.description).toMatch(/Demoli/);
    expect(c1.children.length).toBe(2);
    const a = c1.children[0]!.children[0]!;
    expect(a.code).toBe("1.1.1");
    expect(a.quantity).toBe(1);
    expect(a.unit).toBe("vg");
    expect(a.unitPrice).toBe(3000);
  });

  it("importado para nós planos com os mesmos totais", () => {
    const nodes = importedToNodes(parsed.tree);
    const t = computeTotals(nodes);
    expect(t.totalNet).toBe(22000);
    expect(t.byChapter.length).toBe(9);
    expect(t.byChapter[0]!.net).toBe(5200);
  });
});
