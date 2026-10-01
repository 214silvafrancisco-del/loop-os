import type { ScenarioOutputs } from "@/modules/business-plan/calc";

/** Um lado do P&L (Business Plan ou real), em euros. */
export type PnlSide = {
  acquisition: number;
  works: number;
  holding: number;
  financing: number;
  saleCosts: number;
  totalInvestment: number;
  revenue: number;
  grossProfit: number;
  tax: number;
  netProfit: number;
  margin: number | null;
  roi: number | null;
  months: number | null;
};

export type RealInputs = {
  purchasePrice: number | null;
  acquisitionCosts: number | null;
  /** Faturas da obra registadas, com IVA. */
  worksInvoiced: number;
  holdingCosts: number | null;
  financingCosts: number | null;
  /** Comissões das mediadoras, com IVA, sobre o preço de venda (ou anunciado). */
  agencyCommissions: number;
  otherSaleCosts: number;
  /** Preço final; null enquanto não há escritura. */
  salePrice: number | null;
  /** Preço anunciado, usado como previsão enquanto não há preço final. */
  listingPrice: number | null;
  /** Taxa de imposto do cenário ativo (IRC ou IRS). */
  taxRate: number;
  purchaseDate: string | null;
  saleDate: string | null;
  today: string;
};

export type PnlRowKey = keyof Omit<PnlSide, "months">;
export type PnlRow = { key: PnlRowKey | "months"; label: string; bp: number | null; real: number | null; kind: "money" | "pct" | "months"; /** Custos: desvio positivo é mau. */ cost?: boolean };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function monthsBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(to + "T00:00:00Z");
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + (b.getUTCDate() - a.getUTCDate()) / 30;
  return Math.max(0, Math.round(months * 10) / 10);
}

export function bpSide(o: ScenarioOutputs): PnlSide {
  return {
    acquisition: r2(o.acquisitionTotal),
    works: r2(o.worksTotal),
    holding: r2(o.holdingCosts),
    financing: r2(o.financingCosts + o.interestProperty + o.interestWorks),
    saleCosts: r2(o.saleCosts),
    totalInvestment: r2(o.totalInvestment),
    revenue: r2(o.revenue),
    grossProfit: r2(o.grossProfit),
    tax: r2(o.tax),
    netProfit: r2(o.netProfit),
    margin: o.revenue ? o.margin : null,
    roi: o.totalInvestment ? o.roi : null,
    months: o.months,
  };
}

/** Lado real. `final` diz se a receita é a venda escriturada ou só a previsão pelo preço anunciado. */
export function realSide(i: RealInputs): { side: PnlSide; final: boolean } {
  const acquisition = (i.purchasePrice ?? 0) + (i.acquisitionCosts ?? 0);
  const works = i.worksInvoiced;
  const holding = i.holdingCosts ?? 0;
  const financing = i.financingCosts ?? 0;
  const saleCosts = i.agencyCommissions + i.otherSaleCosts;
  const totalInvestment = acquisition + works + holding + financing + saleCosts;
  const final = i.salePrice !== null;
  const revenue = i.salePrice ?? i.listingPrice ?? 0;
  const grossProfit = revenue - totalInvestment;
  const tax = Math.max(0, grossProfit) * i.taxRate;
  const netProfit = grossProfit - tax;
  return {
    final,
    side: {
      acquisition: r2(acquisition),
      works: r2(works),
      holding: r2(holding),
      financing: r2(financing),
      saleCosts: r2(saleCosts),
      totalInvestment: r2(totalInvestment),
      revenue: r2(revenue),
      grossProfit: r2(grossProfit),
      tax: r2(tax),
      netProfit: r2(netProfit),
      margin: revenue ? netProfit / revenue : null,
      roi: totalInvestment ? grossProfit / totalInvestment : null,
      months: monthsBetween(i.purchaseDate, i.saleDate ?? i.today),
    },
  };
}

export const PNL_ROWS: { key: PnlRow["key"]; label: string; kind: PnlRow["kind"]; cost?: boolean }[] = [
  { key: "acquisition", label: "Aquisição (preço + custos)", kind: "money", cost: true },
  { key: "works", label: "Obra (c/ IVA)", kind: "money", cost: true },
  { key: "holding", label: "Detenção", kind: "money", cost: true },
  { key: "financing", label: "Financiamento e juros", kind: "money", cost: true },
  { key: "saleCosts", label: "Custos de venda (comissões, outros)", kind: "money", cost: true },
  { key: "totalInvestment", label: "Investimento total", kind: "money", cost: true },
  { key: "revenue", label: "Receita (venda)", kind: "money" },
  { key: "grossProfit", label: "Lucro bruto", kind: "money" },
  { key: "tax", label: "Imposto estimado", kind: "money", cost: true },
  { key: "netProfit", label: "Lucro líquido", kind: "money" },
  { key: "margin", label: "Margem (líquido / receita)", kind: "pct" },
  { key: "roi", label: "ROI (bruto / investimento)", kind: "pct" },
  { key: "months", label: "Duração", kind: "months" },
];

export function buildPnl(bp: ScenarioOutputs | null, real: RealInputs): { bp: PnlSide | null; real: PnlSide; final: boolean; rows: PnlRow[] } {
  const b = bp ? bpSide(bp) : null;
  const r = realSide(real);
  const rows = PNL_ROWS.map((row) => ({ ...row, bp: b ? b[row.key] : null, real: r.side[row.key] }));
  return { bp: b, real: r.side, final: r.final, rows };
}
