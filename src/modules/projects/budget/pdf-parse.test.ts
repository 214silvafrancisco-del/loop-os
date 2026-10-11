import { describe, expect, it } from "vitest";
import { classifyLine, parseBudgetHeader, parseBudgetText, parsePtNumber } from "./pdf-parse";

const SAMPLE = `
MADS Construções, Lda.
Rua das Obras 12, 2700-000 Amadora
NIF 512 345 678 · Tel. 912 345 678 · geral@mads.pt
Orçamento n.º 2026/41 — Obra T2 Benfica
Artigo Descrição Un Qtd Unitário Total
1 Demolições
1.1 Demolição de paredes interiores m2 45,00 12,50 562,50
1.2 Remoção de pavimento existente m2 60,00 8,00 480,00
2 Alvenarias e revestimentos 3.250,00
2.1 Parede em tijolo 11 m2 30,00 35,00 1.050,00
2.2 Reboco e estanhado
em paredes novas m2 60,00 20,00 1.200,00
2.3 Betonilha un 1,00 1.000,00 1.000,00
3 Pinturas
3.1 Pintura de tetos e paredes vg 1 2.500,00 2.500,00
Subtotal 6.792,50
IVA 23% 1.562,28
Total 8.354,78
`;

describe("números e linhas", () => {
  it("lê formato português e inglês", () => {
    expect(parsePtNumber("1.234,56")).toBe(1234.56);
    expect(parsePtNumber("562,50")).toBe(562.5);
    expect(parsePtNumber("1234.5")).toBe(1234.5);
    expect(parsePtNumber("45")).toBe(45);
    expect(parsePtNumber("m2")).toBeNull();
  });
  it("classifica capítulo, artigo e continuação", () => {
    expect(classifyLine("1 Demolições")).toEqual({ kind: "chapter", code: "1", description: "Demolições" });
    expect(classifyLine("2 Alvenarias 3.250,00")).toEqual({ kind: "chapter", code: "2", description: "Alvenarias" });
    expect(classifyLine("1.1 Demolição de paredes m2 45,00 12,50 562,50")).toEqual({ kind: "item", code: "1.1", description: "Demolição de paredes", unit: "m2", quantity: 45, unitPrice: 12.5, total: 562.5 });
    expect(classifyLine("em paredes novas")).toEqual({ kind: "text", description: "em paredes novas" });
    expect(classifyLine("Total 8.354,78")).toEqual({ kind: "skip" });
    expect(classifyLine("Pintura vg 1 2.500,00")).toMatchObject({ kind: "item", unit: "vg", quantity: 1, unitPrice: 2500 });
  });
});

describe("orçamento em PDF", () => {
  it("constrói a árvore, soma e junta descrições partidas", () => {
    const p = parseBudgetText(SAMPLE);
    expect(p.tree.map((c) => c.code)).toEqual(["1", "2", "3"]);
    expect(p.tree[1]!.children.map((i) => i.code)).toEqual(["2.1", "2.2", "2.3"]);
    expect(p.tree[1]!.children[1]!.description).toBe("Reboco e estanhado em paredes novas");
    expect(p.items).toBe(6);
    expect(p.total).toBe(6792.5);
    expect(p.doubts).toEqual([]);
  });

  it("cabeçalho do fornecedor", () => {
    const h = parseBudgetHeader(SAMPLE);
    expect(h.name).toBe("MADS Construções, Lda.");
    expect(h.nif).toBe("512345678");
    expect(h.phone).toBe("912 345 678");
    expect(h.email).toBe("geral@mads.pt");
  });

  it("assinala totais que não batem, artigos sem unitário e linhas com só 2 valores", () => {
    const p = parseBudgetText(`1 Capítulo\n1.1 Artigo errado m2 10,00 5,00 100,00\n1.2 Só total un 2,00 300,00\n1.3 Sem valores m2`);
    expect(p.doubts.some((d) => d.startsWith("1.1"))).toBe(true);
    expect(p.tree[0]!.children.find((i) => i.code === "1.2")!.unitPrice).toBe(300);
    expect(p.doubts.some((d) => d.startsWith("1.2"))).toBe(true);
    expect(p.skipped).toBe(1);
  });

  it("artigos sem código ganham código sequencial dentro do capítulo", () => {
    const p = parseBudgetText(`1 Carpintarias\nPorta interior un 3 250,00 750,00\nRodapé ml 40 6,00 240,00`);
    expect(p.tree[0]!.children.map((i) => i.code)).toEqual(["1.1", "1.2"]);
    expect(p.doubts.length).toBe(2);
    expect(p.total).toBe(990);
  });

  it("texto sem linhas de orçamento devolve vazio", () => {
    const p = parseBudgetText("Fotografia digitalizada sem texto útil");
    expect(p.tree).toEqual([]);
    expect(p.items).toBe(0);
  });
});
