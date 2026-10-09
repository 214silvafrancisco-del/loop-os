/**
 * Previsão automática de compras a partir do funil semanal agregado.
 *
 * Princípios (docs/02 §Funil comercial):
 * - O histórico de compras realizadas é a referência principal.
 * - Leads, visitas e propostas só ajustam o ritmo, dentro de limites, e só
 *   com histórico suficiente. Nunca se assume que um negócio avança de fase
 *   na mesma semana: as taxas de conversão são rácios agregados de todo o
 *   histórico, não emparelhamentos semana a semana.
 * - Sem parâmetros manuais. As constantes abaixo são do método, não do negócio.
 * - Código puro: recebe as semanas, devolve a previsão. Testado em forecast.test.ts.
 */

export type FunnelWeek = {
  weekStart: string;
  leads: number | null;
  visits: number | null;
  proposals: number | null;
  purchases: number | null;
};

export type Interval = { expected: number; low: number; high: number };

export type Reliability = "baixa" | "media" | "boa";
export type Trend = { direction: "up" | "down" | "flat"; recentAvg: number; previousAvg: number; weeks: number } | null;

export type Forecast =
  | { status: "insufficient"; filledWeeks: number; minimumWeeks: number; averages: Averages | null }
  | {
      status: "ok";
      filledWeeks: number;
      reliability: Reliability;
      reliabilityNotes: string[];
      /** Compras por semana estimadas (λ). */
      weeklyRate: number;
      /** Componentes do λ, para transparência. */
      baseRate: number;
      funnelRate: number | null;
      funnelWeight: number;
      nextWeek: Interval;
      fourWeeks: Interval;
      threeMonths: Interval;
      trend: Trend;
      averages: Averages;
      conversion: Conversion;
    };

export type Averages = { leads: number | null; visits: number | null; proposals: number | null; purchases: number | null };
export type Conversion = {
  visitsPerLead: number | null;
  proposalsPerVisit: number | null;
  purchasesPerProposal: number | null;
  purchasesPerLead: number | null;
};

/** Semanas completas com compras preenchidas necessárias para prever. */
export const MIN_WEEKS = 4;
/** A partir daqui o funil (leads/propostas) entra no cálculo. */
const FUNNEL_MIN_WEEKS = 8;
const FUNNEL_WEIGHT = 0.35;
/** Meia-vida (semanas) da média móvel exponencial das compras. */
const HALF_LIFE_PURCHASES = 8;
const HALF_LIFE_VOLUME = 4;
/** Encolhimento para a média global com pouco histórico: peso n / (n + K). */
const SHRINK_K = 6;
/** O funil ajusta o ritmo base no máximo ±50 %. */
const FUNNEL_CLAMP = 0.5;

const r = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Média móvel exponencial: a última observação pesa 1, a de h semanas antes pesa ½. */
export function ewma(xs: number[], halfLife: number): number | null {
  if (xs.length === 0) return null;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    const w = Math.pow(0.5, (xs.length - 1 - i) / halfLife);
    num += w * xs[i]!;
    den += w;
  }
  return num / den;
}

/** Quantil de uma Poisson(μ) por soma cumulativa (μ pequeno; para μ grande usa aproximação normal). */
export function poissonQuantile(mu: number, p: number): number {
  if (mu <= 0) return 0;
  if (mu > 60) return Math.max(0, Math.round(mu + (p >= 0.5 ? 1 : -1) * 1.2816 * Math.sqrt(mu)));
  let k = 0;
  let term = Math.exp(-mu);
  let cum = term;
  while (cum < p && k < 1000) {
    k++;
    term *= mu / k;
    cum += term;
  }
  return k;
}

function interval(rate: number, weeks: number): Interval {
  const mu = rate * weeks;
  return { expected: r(mu, weeks === 1 ? 1 : 0), low: poissonQuantile(mu, 0.1), high: poissonQuantile(mu, 0.9) };
}

function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

/** Rácios agregados sobre as semanas em que ambos os valores existem (sem assumir desfasamento). */
export function conversionRates(weeks: FunnelWeek[]): Conversion {
  const pair = (a: keyof FunnelWeek, b: keyof FunnelWeek) => {
    let na = 0;
    let nb = 0;
    for (const w of weeks) {
      const x = w[a];
      const y = w[b];
      if (typeof x === "number" && typeof y === "number") {
        na += x;
        nb += y;
      }
    }
    return ratio(nb, na);
  };
  return {
    visitsPerLead: pair("leads", "visits"),
    proposalsPerVisit: pair("visits", "proposals"),
    purchasesPerProposal: pair("proposals", "purchases"),
    purchasesPerLead: pair("leads", "purchases"),
  };
}

export function averages(weeks: FunnelWeek[]): Averages {
  const col = (k: keyof FunnelWeek) => mean(weeks.map((w) => w[k]).filter((v): v is number => typeof v === "number"));
  return { leads: col("leads"), visits: col("visits"), proposals: col("proposals"), purchases: col("purchases") };
}

/**
 * Previsão a partir das semanas **completas** (ordem cronológica). A semana
 * atual, por estar a meio, não deve entrar aqui.
 */
export function forecastPurchases(completeWeeks: FunnelWeek[]): Forecast {
  const weeks = [...completeWeeks].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  const withPurchases = weeks.filter((w) => typeof w.purchases === "number");
  const n = withPurchases.length;
  if (n < MIN_WEEKS) return { status: "insufficient", filledWeeks: n, minimumWeeks: MIN_WEEKS, averages: weeks.length ? averages(weeks) : null };

  // 1) Ritmo base: EWMA das compras, encolhida para a média global com pouco histórico.
  const purchases = withPurchases.map((w) => w.purchases as number);
  const globalMean = mean(purchases)!;
  const recent = ewma(purchases, HALF_LIFE_PURCHASES)!;
  const shrink = n / (n + SHRINK_K);
  const baseRate = shrink * recent + (1 - shrink) * globalMean;

  // 2) Funil: volume recente de propostas e leads × rácios agregados → ritmo implícito.
  const conv = conversionRates(weeks);
  let funnelRate: number | null = null;
  let funnelWeight = 0;
  if (n >= FUNNEL_MIN_WEEKS) {
    const lastWeeks = weeks.slice(-8);
    const recentProposals = ewma(lastWeeks.map((w) => w.proposals).filter((v): v is number => typeof v === "number"), HALF_LIFE_VOLUME);
    const recentLeads = ewma(lastWeeks.map((w) => w.leads).filter((v): v is number => typeof v === "number"), HALF_LIFE_VOLUME);
    const implied: number[] = [];
    if (recentProposals !== null && conv.purchasesPerProposal !== null) implied.push(recentProposals * conv.purchasesPerProposal);
    if (recentLeads !== null && conv.purchasesPerLead !== null) implied.push(recentLeads * conv.purchasesPerLead);
    if (implied.length) {
      const raw = mean(implied)!;
      // Limita o ajuste: o funil nunca mais do que ±50 % do ritmo histórico.
      funnelRate = Math.min(baseRate * (1 + FUNNEL_CLAMP), Math.max(baseRate * (1 - FUNNEL_CLAMP), raw));
      funnelWeight = FUNNEL_WEIGHT;
    }
  }
  const weeklyRate = funnelRate === null ? baseRate : (1 - funnelWeight) * baseRate + funnelWeight * funnelRate;

  // 3) Tendência: últimas 4 semanas vs as 8 anteriores (ou as que houver, mínimo 4).
  let trend: Trend = null;
  if (n >= 8) {
    const last4 = mean(purchases.slice(-4))!;
    const prev = purchases.slice(-12, -4);
    const prevAvg = mean(prev)!;
    const diff = last4 - prevAvg;
    const direction = Math.abs(diff) >= Math.max(0.25, 0.2 * Math.max(prevAvg, 0.01)) ? (diff > 0 ? "up" : "down") : "flat";
    trend = { direction, recentAvg: r(last4), previousAvg: r(prevAvg), weeks: prev.length };
  }

  // 4) Fiabilidade: quantidade de histórico, penalizada por variabilidade e lacunas.
  const notes: string[] = [];
  let level: Reliability = n >= 16 ? "boa" : n >= 8 ? "media" : "baixa";
  const sd = Math.sqrt(mean(purchases.map((p) => (p - globalMean) ** 2))!);
  const cv = globalMean > 0 ? sd / globalMean : null;
  const gaps = weeks.length - n;
  if (cv !== null && cv > 1.2 && level !== "baixa") {
    level = level === "boa" ? "media" : "baixa";
    notes.push("compras muito irregulares de semana para semana");
  }
  if (gaps > 0 && gaps / weeks.length > 0.25 && level !== "baixa") {
    level = level === "boa" ? "media" : "baixa";
    notes.push(`${gaps} semana${gaps > 1 ? "s" : ""} sem compras preenchidas`);
  }
  if (n < FUNNEL_MIN_WEEKS) notes.push(`o funil só entra no cálculo a partir de ${FUNNEL_MIN_WEEKS} semanas`);

  return {
    status: "ok",
    filledWeeks: n,
    reliability: level,
    reliabilityNotes: notes,
    weeklyRate: r(weeklyRate, 3),
    baseRate: r(baseRate, 3),
    funnelRate: funnelRate === null ? null : r(funnelRate, 3),
    funnelWeight,
    nextWeek: interval(weeklyRate, 1),
    fourWeeks: interval(weeklyRate, 4),
    threeMonths: interval(weeklyRate, 13),
    trend,
    averages: averages(weeks),
    conversion: conv,
  };
}
