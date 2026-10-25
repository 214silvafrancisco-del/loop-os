import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_COLORS as C } from "@/core/pdf/brand";

/** Dados do auto já calculados e formatados no servidor (sem acesso à BD no template). */
export type AutoPdfData = {
  kind: "trabalho" | "adiantamento";
  number: number;
  status: "draft" | "closed";
  periodLabel: string;
  reportDate: string;
  generatedAt: string;
  notes: string | null;
  company: { name: string; nif: string | null; address: string | null };
  project: { name: string; ref: string; address: string };
  supplier: { name: string; nif: string | null; email: string | null; phone: string | null };
  totals: { budget: number; cumulative: number; period: number; progress: number };
  /** Adiantamento em vigor (fração) e líquido a faturar neste auto de trabalho. */
  advance: { pct: number; netToInvoice: number } | null;
  /** Só nos autos de adiantamento. */
  advanceAuto: { amount: number; pct: number } | null;
  chapters: {
    title: string;
    budget: number;
    cumulative: number;
    period: number;
    lines: { code: string | null; description: string; budget: number; previousPct: number; pct: number; cumulative: number; period: number }[];
  }[];
};

// Sem hifenização automática: as descrições dos artigos quebram por palavra inteira.
Font.registerHyphenationCallback((word) => [word]);

const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const money = (v: number) => eur.format(v);
const pct = (v: number) => `${Math.round(v * 1000) / 10} %`;

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9, color: C.ink, fontFamily: "Helvetica", lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  logo: { width: 96 },
  headerRight: { alignItems: "flex-end" },
  small: { fontSize: 8, color: C.muted },
  // lineHeight explícito: o valor da página resolve-se em pontos (9 × 1.4) e seria herdado pelo título, que ficava mais baixo do que as letras.
  title: { fontSize: 17, lineHeight: 1.25, fontFamily: "Helvetica-Bold", letterSpacing: 0.4, marginBottom: 2 },
  draft: { marginTop: 3, fontSize: 8, color: C.warn, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },
  cols: { flexDirection: "row", gap: 16, marginBottom: 14 },
  col: { flex: 1, backgroundColor: C.canvas, borderRadius: 5, padding: 9 },
  colTitle: { fontSize: 7.5, color: C.orange, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  kv: { flexDirection: "row", marginBottom: 1.5 },
  k: { width: 62, color: C.muted },
  v: { flex: 1 },
  stats: { flexDirection: "row", gap: 8, marginBottom: 14 },
  stat: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 5, padding: 8 },
  statLabel: { fontSize: 7, color: C.muted, letterSpacing: 0.8, textTransform: "uppercase" },
  statValue: { fontSize: 12, lineHeight: 1.3, fontFamily: "Helvetica-Bold", marginTop: 2 },
  table: { borderTopWidth: 1, borderTopColor: C.ink },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 3 },
  th: { fontSize: 7.5, color: C.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  chapter: { backgroundColor: C.canvas, fontFamily: "Helvetica-Bold" },
  total: { borderTopWidth: 1, borderTopColor: C.ink, fontFamily: "Helvetica-Bold", paddingVertical: 4 },
  cCode: { width: 36, color: C.muted, fontSize: 8 },
  cDesc: { flex: 1, paddingRight: 6 },
  cNum: { width: 64, textAlign: "right" },
  cPct: { width: 46, textAlign: "right" },
  notes: { marginTop: 12, padding: 8, borderWidth: 1, borderColor: C.line, borderRadius: 5 },
  signatures: { flexDirection: "row", gap: 40, marginTop: 34 },
  sig: { flex: 1, borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 4, fontSize: 8, color: C.muted },
  footer: { position: "absolute", left: 40, right: 40, bottom: 24, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, fontSize: 7.5, color: C.muted },
});

function KV({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <View style={s.kv}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v}>{v}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

/** Auto de medição (trabalho ou adiantamento) para partilhar com o fornecedor. */
export function AutoPdf({ data, logoSrc }: { data: AutoPdfData; logoSrc: string | null }) {
  const isWork = data.kind === "trabalho";
  const title = isWork ? `Auto de medição n.º ${data.number}` : `Auto de adiantamento n.º ${data.number}`;
  return (
    <Document title={`${title} · ${data.project.ref}`} author={data.company.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {logoSrc ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt
            <Image src={logoSrc} style={s.logo} />
          ) : (
            <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold" }}>Loop.</Text>
          )}
          <View style={s.headerRight}>
            <Text style={s.title}>{title}</Text>
            <Text style={s.small}>
              {isWork ? `Período ${data.periodLabel} · ` : ""}data do auto {data.reportDate}
            </Text>
            {data.status === "draft" ? <Text style={s.draft}>Rascunho · sujeito a alteração</Text> : null}
          </View>
        </View>

        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.colTitle}>Dono de obra</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.company.name}</Text>
            <KV k="NIF" v={data.company.nif} />
            <KV k="Morada" v={data.company.address} />
          </View>
          <View style={s.col}>
            <Text style={s.colTitle}>Obra</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.project.name}</Text>
            <KV k="Referência" v={data.project.ref} />
            <KV k="Local" v={data.project.address} />
          </View>
          <View style={s.col}>
            <Text style={s.colTitle}>Fornecedor</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.supplier.name}</Text>
            <KV k="NIF" v={data.supplier.nif} />
            <KV k="Email" v={data.supplier.email} />
            <KV k="Telefone" v={data.supplier.phone} />
          </View>
        </View>

        {/* Auto de trabalho: sem fila de totais (o Total da tabela chega); no de adiantamento são a informação principal. */}
        {isWork ? null : (
          <View style={s.stats}>
            <Stat label="Valor do adiantamento" value={money(data.advanceAuto?.amount ?? 0)} />
            <Stat label="Percentagem a descontar nos autos seguintes" value={pct(data.advanceAuto?.pct ?? 0)} />
            <Stat label="Adjudicado" value={money(data.totals.budget)} />
          </View>
        )}

        {isWork ? (
          <View style={s.table}>
            <View style={s.tr} fixed>
              <Text style={[s.cCode, s.th]}>Cód.</Text>
              <Text style={[s.cDesc, s.th]}>Artigo</Text>
              <Text style={[s.cNum, s.th]}>Orçamentado</Text>
              <Text style={[s.cPct, s.th]}>% ant.</Text>
              <Text style={[s.cPct, s.th]}>% acum.</Text>
              <Text style={[s.cNum, s.th]}>Acumulado</Text>
              <Text style={[s.cNum, s.th]}>Neste auto</Text>
            </View>
            {data.chapters.map((ch) => (
              <View key={ch.title} wrap>
                <View style={[s.tr, s.chapter]} minPresenceAhead={40}>
                  <Text style={s.cCode} />
                  <Text style={s.cDesc}>{ch.title}</Text>
                  <Text style={s.cNum}>{money(ch.budget)}</Text>
                  <Text style={s.cPct} />
                  <Text style={s.cPct}>{ch.budget ? pct(ch.cumulative / ch.budget) : ""}</Text>
                  <Text style={s.cNum}>{money(ch.cumulative)}</Text>
                  <Text style={s.cNum}>{money(ch.period)}</Text>
                </View>
                {ch.lines.map((l, i) => (
                  <View key={i} style={s.tr}>
                    <Text style={s.cCode}>{l.code ?? ""}</Text>
                    <Text style={s.cDesc}>{l.description}</Text>
                    <Text style={s.cNum}>{money(l.budget)}</Text>
                    <Text style={[s.cPct, { color: C.muted }]}>{pct(l.previousPct)}</Text>
                    <Text style={s.cPct}>{pct(l.pct)}</Text>
                    <Text style={s.cNum}>{money(l.cumulative)}</Text>
                    <Text style={[s.cNum, l.period < 0 ? { color: C.warn } : {}]}>{money(l.period)}</Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={[s.tr, s.total]}>
              <Text style={s.cCode} />
              <Text style={s.cDesc}>Total</Text>
              <Text style={s.cNum}>{money(data.totals.budget)}</Text>
              <Text style={s.cPct} />
              <Text style={s.cPct}>{pct(data.totals.progress)}</Text>
              <Text style={s.cNum}>{money(data.totals.cumulative)}</Text>
              <Text style={s.cNum}>{money(data.totals.period)}</Text>
            </View>
          </View>
        ) : null}

        {data.notes ? (
          <View style={s.notes}>
            <Text style={s.colTitle}>Notas</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        <View style={s.signatures} wrap={false}>
          <View style={s.sig}>
            <Text>{data.company.name} (dono de obra)</Text>
          </View>
          <View style={s.sig}>
            <Text>{data.supplier.name} (fornecedor)</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {title} · {data.project.ref} · gerado em {data.generatedAt}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
