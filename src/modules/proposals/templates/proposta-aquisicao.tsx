import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatEur, formatLongDate, type ProposalSnapshot } from "../snapshot";

/** Cores da identidade LOOP (ver globals.css). */
const INK = "#262626";
const ORANGE = "#F97B22";
const MUTED = "#8A8580";
const LINE = "#E6E1DA";
const CANVAS = "#F7F4EF";

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 64, paddingHorizontal: 56, fontSize: 10.5, color: INK, fontFamily: "Helvetica", lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  logo: { width: 110 },
  headerRight: { alignItems: "flex-end" },
  small: { fontSize: 8.5, color: MUTED },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 4 },
  subtitle: { fontSize: 10.5, color: MUTED, marginBottom: 22 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 8.5, color: ORANGE, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5 },
  label: { width: 150, color: MUTED },
  value: { flex: 1 },
  priceBox: { backgroundColor: CANVAS, borderRadius: 6, padding: 14, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontSize: 9, color: MUTED, letterSpacing: 1, textTransform: "uppercase" },
  price: { fontSize: 22, fontFamily: "Helvetica-Bold", color: INK },
  paragraph: { marginBottom: 4 },
  footer: { position: "absolute", left: 56, right: 56, bottom: 30, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  signature: { marginTop: 36 },
  signatureLine: { width: 200, borderTopWidth: 1, borderTopColor: INK, paddingTop: 4, marginTop: 34 },
});

export type TemplateProps = { data: ProposalSnapshot; logoSrc: string | null };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

export function PropostaAquisicao({ data, logoSrc }: TemplateProps) {
  const p = data.property;
  const o = data.offer;
  const address = [p.addressLine, [p.postalCode, p.parish].filter(Boolean).join(" "), p.municipality].filter(Boolean).join(", ");
  return (
    <Document title={`Proposta ${data.number}`} author={data.company.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {logoSrc ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt
            <Image src={logoSrc} style={s.logo} />
          ) : (
            <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold" }}>Loop.</Text>
          )}
          <View style={s.headerRight}>
            <Text style={s.small}>Proposta n.º {data.number}{data.versionNo > 1 ? ` · v${data.versionNo}` : ""}</Text>
            <Text style={s.small}>{formatLongDate(data.date)}</Text>
          </View>
        </View>

        <Text style={s.title}>Proposta de Aquisição</Text>
        <Text style={s.subtitle}>
          {p.title}
          {data.recipient?.name ? ` · A/C ${data.recipient.name}${data.recipient.company ? ` (${data.recipient.company})` : ""}` : ""}
        </Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Imóvel</Text>
          <Row label="Morada" value={address} />
          <Row label="Tipologia" value={p.typology} />
          <Row label="Área bruta" value={p.grossArea ? `${p.grossArea.toLocaleString("pt-PT")} m²` : null} />
          <Row label="Piso" value={p.floor} />
          <Row label="Artigo matricial" value={[p.matrixArticle, p.fraction ? `fração ${p.fraction}` : null].filter(Boolean).join(" · ") || null} />
          <Row label="Referência interna" value={p.ref} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Condições propostas</Text>
          <View style={s.priceBox}>
            <Text style={s.priceLabel}>Preço de aquisição</Text>
            <Text style={s.price}>{formatEur(o.price)}</Text>
          </View>
          <Row label="Prazo para escritura" value={o.deadlineDays ? `${o.deadlineDays} dias após a aceitação` : "a combinar"} />
          <Row label="Validade da proposta" value={o.validityDays ? `${o.validityDays} dias` : "a combinar"} />
          {o.conditions ? (
            <View style={{ marginTop: 8 }}>
              {o.conditions.split(/\n+/).map((line, i) => (
                <Text key={i} style={s.paragraph}>• {line.trim()}</Text>
              ))}
            </View>
          ) : null}
        </View>

        {o.observations ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Observações</Text>
            {o.observations.split(/\n+/).map((line, i) => (
              <Text key={i} style={s.paragraph}>{line.trim()}</Text>
            ))}
          </View>
        ) : null}

        <View style={s.signature}>
          <Text>Com os melhores cumprimentos,</Text>
          <View style={s.signatureLine}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.company.signature}</Text>
            <Text style={s.small}>{formatLongDate(data.date)}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.small}>
            {data.company.name}
            {data.company.nif ? ` · NIF ${data.company.nif}` : ""}
            {data.company.address ? ` · ${data.company.address}` : ""}
          </Text>
          <Text style={s.small} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
