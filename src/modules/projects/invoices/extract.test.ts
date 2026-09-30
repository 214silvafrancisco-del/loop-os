import { describe, expect, it } from "vitest";
import { parseAmount, parseDate, parseInvoiceText } from "./extract";

describe("números e datas", () => {
  it("valores em formato português e internacional", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1 234,56 €")).toBe(1234.56);
    expect(parseAmount("1234.56")).toBe(1234.56);
    expect(parseAmount("33.500,00")).toBe(33500);
    expect(parseAmount("33500")).toBe(33500);
    expect(parseAmount("12,5")).toBe(12.5);
  });
  it("datas", () => {
    expect(parseDate("30/09/2026")).toBe("2026-09-30");
    expect(parseDate("30-09-2026")).toBe("2026-09-30");
    expect(parseDate("2026-09-30")).toBe("2026-09-30");
    expect(parseDate("31/13/2026")).toBeNull();
  });
});

describe("leitura de faturas", () => {
  it("fatura de software de faturação (Moloni/InvoiceXpress-like)", () => {
    const text = `
      EMPREITEIRO CONSTRUÇÕES, LDA
      NIF: 501 234 567
      Rua das Obras 1, Lisboa
      Fatura FT 2026/45
      Data: 15/10/2026   Vencimento: 14/11/2026
      Cliente: LOOP Homes, Lda   NIF 509 876 543
      Descrição                Qtd   Preço   Total
      Auto n.º 1 – Setembro     1   33.500,00   33.500,00
      Subtotal                                  33.500,00 €
      IVA (23%)                                  7.705,00 €
      Total                                     41.205,00 €
    `;
    const r = parseInvoiceText(text);
    expect(r.number).toBe("FT 2026/45");
    expect(r.issueDate).toBe("2026-10-15");
    expect(r.dueDate).toBe("2026-11-14");
    expect(r.netAmount).toBe(33500);
    expect(r.vatAmount).toBe(7705);
    expect(r.total).toBe(41205);
    expect(r.vatRate).toBe(0.23);
    expect(r.nifs).toEqual(["501234567", "509876543"]);
    expect(r.warnings).toEqual([]);
  });

  it("fatura-recibo com IVA a 6 % e só total e base", () => {
    const text = `
      Fatura-Recibo n.º FR A/12
      Data de emissão 03-02-2026
      NIF 123456789
      Base tributável 10.000,00
      Total a pagar 10.600,00 EUR
    `;
    const r = parseInvoiceText(text);
    expect(r.number).toBe("FR A/12");
    expect(r.issueDate).toBe("2026-02-03");
    expect(r.dueDate).toBeNull();
    expect(r.netAmount).toBe(10000);
    expect(r.vatAmount).toBe(600);
    expect(r.vatRate).toBe(0.06);
    expect(r.total).toBe(10600);
  });

  it("só total e taxa: deduz base e IVA", () => {
    const r = parseInvoiceText("Fatura nº 2026-001  Data 01/03/2026  Taxa IVA 23%  TOTAL 1.230,00");
    expect(r.number).toBe("2026-001");
    expect(r.total).toBe(1230);
    expect(r.netAmount).toBe(1000);
    expect(r.vatAmount).toBe(230);
    expect(r.vatRate).toBe(0.23);
  });

  it("valores incoerentes geram aviso e o total manda", () => {
    const r = parseInvoiceText("FT 1/2026 Data 01/03/2026 Subtotal 900,00 IVA 23% 230,00 Total 1.230,00");
    expect(r.warnings.some((w) => w.includes("não batem"))).toBe(true);
    expect(r.netAmount).toBe(1000);
    expect(r.total).toBe(1230);
  });

  it("PDF sem texto avisa", () => {
    const r = parseInvoiceText("   ");
    expect(r.found).toEqual([]);
    expect(r.warnings[0]).toContain("digitalização");
  });
});
