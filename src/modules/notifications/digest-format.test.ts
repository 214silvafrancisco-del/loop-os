import { describe, expect, it } from "vitest";
import { formatDigest, type DigestData } from "./digest-format";

const empty: DigestData = { actionsDue: 0, actionsOverdue: 0, firstAction: null, invoicesDue: 0, invoicesOverdue: 0, invoicesAmount: 0 };

describe("formatDigest", () => {
  it("não envia nada quando não há ações nem faturas", () => {
    expect(formatDigest(empty)).toBeNull();
  });

  it("conta ações de hoje e atrasadas, com a próxima", () => {
    const p = formatDigest({ ...empty, actionsDue: 3, actionsOverdue: 1, firstAction: "LH-0007 · Ligar ao vendedor" });
    expect(p?.title).toBe("LOOP OS · Hoje");
    expect(p?.body).toBe("2 ações para hoje e 1 atrasada\nPróxima: LH-0007 · Ligar ao vendedor");
    expect(p?.url).toBe("/dashboard");
  });

  it("só atrasadas usa singular/plural certo", () => {
    expect(formatDigest({ ...empty, actionsDue: 1, actionsOverdue: 1 })?.body).toBe("1 ação atrasada");
    expect(formatDigest({ ...empty, actionsDue: 2, actionsOverdue: 2 })?.body).toBe("2 ações atrasadas");
  });

  it("faturas a vencer e vencidas com o total por pagar", () => {
    const p = formatDigest({ ...empty, invoicesDue: 3, invoicesOverdue: 1, invoicesAmount: 4250.4 });
    expect(p?.body).toBe("2 faturas vencem esta semana, 1 fatura vencida · 4250 € por pagar");
  });

  it("junta ações e faturas em linhas separadas", () => {
    const p = formatDigest({ ...empty, actionsDue: 1, invoicesDue: 1, invoicesAmount: 100 });
    expect(p?.body.split("\n")).toEqual(["1 ação para hoje", "1 fatura vence esta semana · 100 € por pagar"]);
  });
});
