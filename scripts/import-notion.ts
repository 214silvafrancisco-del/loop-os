/**
 * Importa a base "Negócios" do Notion (export CSV + anexos) para o LOOP OS.
 *
 *   pnpm import:notion --dir <pasta com o CSV _all e os xlsx>            (dry-run, escreve import-report.md)
 *   pnpm import:notion --dir <pasta> --apply                             (grava na base de dados)
 *   opções: --owner <email>  responsável dos negócios (por defeito: primeiro admin)
 *
 * Mapeamento (docs/01, secção 0): Score → fase; Status → ativo/excluído; Fonte → fonte;
 * Nome/Contacto → contacto; Morada/Freguesia/Andar/Tipologia → imóvel; Preço → preço pedido;
 * Prox Ação/Date → próxima ação; Files & media → documentos (Business Plan).
 * Idempotente: imóveis por morada normalizada, contactos por telefone, negócios por
 * (imóvel, data de entrada, preço).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/core/db/schema";
import { normalizeText } from "../src/core/lib/format";
import { normalizePhone } from "../src/modules/contacts/validation";
import { normalizeAddress } from "../src/modules/properties/validation";
import { defaultDealName } from "../src/modules/deals/validation";
import { createDocumentWithFile } from "../src/modules/documents/service";

// ── CLI ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DIR = opt("dir");
const APPLY = args.includes("--apply");
const OWNER_EMAIL = opt("owner");
if (!DIR) {
  console.log("Uso: pnpm import:notion --dir <pasta> [--apply] [--owner email]");
  process.exit(1);
}

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL não definida em .env.local");
const sql = postgres(url, { prepare: false, max: 1 });
const db = drizzle(sql, { schema });

// ── CSV ───────────────────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((v) => v !== "")) rows.push(row); }
  const header = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// ── Normalizações ─────────────────────────────────────────────────────────
function parsePrice(s: string): string | null {
  const n = Number(s.replace(/[€\s]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
}
function parseDate(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}
function parseFloor(s: string): { floor: string | null; type: "apartamento" | "predio" | "moradia" } {
  const t = s.trim();
  if (!t) return { floor: null, type: "apartamento" };
  if (/pr[eé]dio/i.test(t)) return { floor: null, type: "predio" };
  if (/moradia/i.test(t)) return { floor: null, type: "moradia" };
  if (/^rc$/i.test(t)) return { floor: "RC", type: "apartamento" };
  if (/^cv$/i.test(t)) return { floor: "CV", type: "apartamento" };
  const m = t.match(/^(\d+)/);
  return { floor: m ? m[1]! : t, type: "apartamento" };
}
const MUNICIPALITY: Record<string, string> = {
  benfica: "Lisboa", "sao domingos de benfica": "Lisboa", alvalade: "Lisboa", lumiar: "Lisboa", "penha de franca": "Lisboa",
  ameixoeira: "Lisboa", alameda: "Lisboa", picoas: "Lisboa", areeiro: "Lisboa", arroios: "Lisboa", campolide: "Lisboa", carnide: "Lisboa",
  amadora: "Amadora", venteira: "Amadora", damaia: "Amadora", "mina de agua": "Amadora", falagueira: "Amadora", reboleira: "Amadora", brandoa: "Amadora",
  odivelas: "Odivelas", pontinha: "Odivelas", ramada: "Odivelas", "povoa de santo adriao": "Odivelas",
  queluz: "Sintra", cacem: "Sintra", "rio de mouro": "Sintra", massama: "Sintra", agualva: "Sintra", "mem martins": "Sintra",
  "linda-a-velha": "Oeiras", "linda a velha": "Oeiras", "paco de arcos": "Oeiras", carnaxide: "Oeiras", oeiras: "Oeiras", algés: "Oeiras", alges: "Oeiras",
  sacavem: "Loures", loures: "Loures", "forte da casa": "Vila Franca de Xira", "povoa de santa iria": "Vila Franca de Xira",
};
function municipalityOf(parish: string | null): string | null {
  if (!parish) return null;
  return MUNICIPALITY[normalizeText(parish)] ?? null;
}
const SOURCE_ALIAS: Record<string, string> = { "placa de rua": "Placa de rua", proprietario: "Proprietário", sites: "Sites", consultor: "Consultor", investidor: "Investidor" };

// ── Import ────────────────────────────────────────────────────────────────
type Report = {
  rows: number;
  byScore: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  properties: { created: number; matchedDb: number; matchedInFile: number };
  contacts: { created: number; matched: number; skipped: number };
  deals: { created: number; skipped: number };
  documents: { attached: number; missing: string[] };
  warnings: string[];
};

async function main() {
  const files = readdirSync(DIR!);
  const csvName = files.find((f) => /_all\.csv$/i.test(f)) ?? files.find((f) => /\.csv$/i.test(f));
  if (!csvName) throw new Error(`Não encontrei um CSV em ${DIR}`);
  const rows = parseCsv(readFileSync(path.join(DIR!, csvName), "utf8"));

  const [org] = await db.select().from(schema.organizations).limit(1);
  if (!org) throw new Error("Sem organização. Corre pnpm db:seed primeiro.");
  const owner = OWNER_EMAIL
    ? (await db.select().from(schema.profiles).where(eq(schema.profiles.email, OWNER_EMAIL)))[0]
    : (await db.select().from(schema.profiles).where(and(eq(schema.profiles.organizationId, org.id), eq(schema.profiles.role, "admin"))))[0];
  if (!owner) throw new Error("Responsável não encontrado (usa --owner email).");
  const actor = { id: owner.id, organizationId: org.id };

  const stages = await db.select().from(schema.dealStages).where(eq(schema.dealStages.organizationId, org.id));
  const sources = await db.select().from(schema.sourceChannels).where(eq(schema.sourceChannels.organizationId, org.id));
  const [bpCategory] = await db
    .select()
    .from(schema.documentCategories)
    .where(and(eq(schema.documentCategories.organizationId, org.id), eq(schema.documentCategories.name, "Business Plan")));
  const stageByName = new Map(stages.map((s) => [normalizeText(s.name), s]));
  const sourceByName = new Map(sources.map((s) => [normalizeText(s.name), s]));
  const defaultStage = stages.find((s) => s.isDefault) ?? stages[0]!;

  const existingProps = await db.select().from(schema.properties).where(eq(schema.properties.organizationId, org.id));
  const propByAddress = new Map(existingProps.map((p) => [p.addressNormalized, p]));
  const existingContacts = await db.select().from(schema.contacts).where(eq(schema.contacts.organizationId, org.id));
  const contactByPhone = new Map(existingContacts.filter((c) => c.phoneNormalized).map((c) => [c.phoneNormalized!, c]));
  const contactByName = new Map(existingContacts.map((c) => [normalizeText(c.name), c]));
  const existingDeals = await db.select().from(schema.deals).where(eq(schema.deals.organizationId, org.id));
  const dealKeys = new Set(existingDeals.map((d) => `${d.propertyId}|${d.enteredAt}|${d.askingPrice ?? ""}`));

  const report: Report = {
    rows: rows.length, byScore: {}, byStatus: {}, bySource: {},
    properties: { created: 0, matchedDb: 0, matchedInFile: 0 },
    contacts: { created: 0, matched: 0, skipped: 0 },
    deals: { created: 0, skipped: 0 },
    documents: { attached: 0, missing: [] },
    warnings: [],
  };
  const count = (m: Record<string, number>, k: string) => (m[k || "(vazio)"] = (m[k || "(vazio)"] ?? 0) + 1);

  // Ordem cronológica, para o seq dos negócios no mesmo imóvel.
  const sorted = [...rows].sort((a, b) => (parseDate(a.Data ?? "") ?? "").localeCompare(parseDate(b.Data ?? "") ?? ""));

  for (const [i, r] of sorted.entries()) {
    const line = `linha ${i + 1} (${r.Morada || r.Freguesia || "?"})`;
    count(report.byScore, r.Score ?? "");
    count(report.byStatus, r.Status ?? "");
    count(report.bySource, r.Fonte ?? "");

    // Imóvel
    const parish = r.Freguesia || null;
    const { floor, type } = parseFloor(r.Andar ?? "");
    let addressLine = r.Morada?.trim() ?? "";
    if (!addressLine) {
      // Sem morada não há como saber se é o mesmo imóvel: cada linha fica um imóvel
      // próprio, identificado pela data de entrada, para o utilizador completar depois.
      const when = parseDate(r.Data ?? "") ?? `linha ${i + 1}`;
      addressLine = `${r.Tipologia || "Imóvel"} ${parish ?? ""} (morada por confirmar · ${when})`.replace(/\s+/g, " ").trim();
      report.warnings.push(`${line}: sem morada; criado como "${addressLine}"`);
    }
    const addressNormalized = normalizeAddress(addressLine, parish);
    let property = propByAddress.get(addressNormalized);
    let propertyIsNew = false;
    if (property) {
      if (existingProps.some((p) => p.id === property!.id)) report.properties.matchedDb++;
      else report.properties.matchedInFile++;
    } else {
      propertyIsNew = true;
      report.properties.created++;
      const values = {
        organizationId: org.id,
        propertyType: type,
        addressLine,
        addressNormalized,
        parish,
        municipality: municipalityOf(parish),
        typology: r.Tipologia || null,
        floor,
        createdBy: owner.id,
        updatedBy: owner.id,
      } as const;
      if (APPLY) {
        const [created] = await db.insert(schema.properties).values(values).returning();
        property = created!;
      } else {
        property = { ...values, id: `dry-${i}`, ref: "LH-????", status: "prospect" } as unknown as typeof schema.properties.$inferSelect;
      }
      propByAddress.set(addressNormalized, property);
    }

    // Contacto
    let contactId: string | null = null;
    const contactName = (r.Nome ?? "").trim();
    const phone = (r.Contacto ?? "").trim();
    const phoneNormalized = normalizePhone(phone);
    if (contactName || phoneNormalized) {
      const found = (phoneNormalized && contactByPhone.get(phoneNormalized)) || (contactName && contactByName.get(normalizeText(contactName)));
      if (found) {
        contactId = found.id;
        report.contacts.matched++;
      } else {
        const fonte = normalizeText(r.Fonte ?? "");
        const roles = [fonte === "consultor" ? "consultor" : fonte === "proprietario" ? "proprietario" : "outro"] as ("consultor" | "proprietario" | "outro")[];
        const values = {
          organizationId: org.id,
          kind: "person" as const,
          name: contactName || phone,
          roles,
          phone: phone || null,
          phoneNormalized,
          createdBy: owner.id,
          updatedBy: owner.id,
        };
        if (APPLY) {
          const [created] = await db.insert(schema.contacts).values(values).returning();
          contactId = created!.id;
          if (phoneNormalized) contactByPhone.set(phoneNormalized, created!);
          contactByName.set(normalizeText(created!.name), created!);
        } else {
          contactId = `dry-c-${i}`;
          const fake = { ...values, id: contactId } as unknown as typeof schema.contacts.$inferSelect;
          if (phoneNormalized) contactByPhone.set(phoneNormalized, fake);
          contactByName.set(normalizeText(fake.name), fake);
        }
        report.contacts.created++;
      }
    } else report.contacts.skipped++;

    // Negócio
    const stage = stageByName.get(normalizeText(r.Score ?? "")) ?? defaultStage;
    if (!stageByName.has(normalizeText(r.Score ?? ""))) report.warnings.push(`${line}: Score "${r.Score}" desconhecido → ${defaultStage.name}`);
    const sourceName = SOURCE_ALIAS[normalizeText(r.Fonte ?? "")] ?? r.Fonte;
    const source = sourceName ? sourceByName.get(normalizeText(sourceName)) : undefined;
    if (r.Fonte && !source) report.warnings.push(`${line}: Fonte "${r.Fonte}" desconhecida`);
    const enteredAt = parseDate(r.Data ?? "") ?? new Date().toISOString().slice(0, 10);
    if (!parseDate(r.Data ?? "")) report.warnings.push(`${line}: data de entrada "${r.Data}" ilegível → hoje`);
    const askingPrice = parsePrice(r["Preço"] ?? "");
    const excluded = /exclu/i.test(r.Status ?? "");
    const key = `${property!.id}|${enteredAt}|${askingPrice ?? ""}`;
    if (dealKeys.has(key)) {
      report.deals.skipped++;
      report.warnings.push(`${line}: negócio repetido (mesmo imóvel, data ${enteredAt} e preço ${askingPrice ?? "—"}); ignorado`);
      continue;
    }
    dealKeys.add(key);
    const seq = existingDeals.filter((d) => d.propertyId === property!.id).length + [...dealKeys].filter((k) => k.startsWith(property!.id + "|")).length;

    let dealId: string | null = null;
    if (APPLY) {
      const [created] = await db
        .insert(schema.deals)
        .values({
          organizationId: org.id,
          propertyId: property!.id,
          seq: propertyIsNew ? 1 : Math.max(1, seq),
          name: defaultDealName({ typology: r.Tipologia || null, parish, municipality: municipalityOf(parish), addressLine }),
          stageId: stage.id,
          status: excluded ? "excluded" : "active",
          excludedAt: excluded ? new Date() : null,
          ownerUserId: owner.id,
          enteredAt,
          sourceChannelId: source?.id ?? null,
          sourceContactId: contactId && !contactId.startsWith("dry-") ? contactId : null,
          listingUrl: r.Link || null,
          nextAction: r["Prox Ação"] || null,
          nextActionDate: parseDate(r.Date ?? ""),
          askingPrice,
          createdBy: owner.id,
          updatedBy: owner.id,
        })
        .returning({ id: schema.deals.id });
      dealId = created!.id;
      if (stage.isPurchase && !excluded) {
        await db.update(schema.properties).set({ status: "owned", updatedBy: owner.id }).where(eq(schema.properties.id, property!.id));
      }
    }
    report.deals.created++;

    // Documentos (Files & media): nomes de ficheiros separados por vírgula.
    const media = (r["Files & media"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const name of media) {
      const file = files.find((f) => f === name) ?? files.find((f) => normalizeText(f) === normalizeText(name));
      if (!file) {
        report.documents.missing.push(`${line}: ${name}`);
        continue;
      }
      if (APPLY && dealId) {
        const bytes = new Uint8Array(readFileSync(path.join(DIR!, file)));
        await createDocumentWithFile(
          actor,
          { propertyId: property!.id, entityType: "deal", entityId: dealId, categoryId: bpCategory?.id ?? null, name: file.replace(/\.[^.]+$/, ""), description: "Importado do Notion", docDate: enteredAt },
          { fileName: file, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes },
        );
      }
      report.documents.attached++;
    }
  }

  // Relatório
  const md = [
    `# Importação do Notion · ${APPLY ? "APLICADA" : "dry-run"} · ${new Date().toISOString()}`,
    ``,
    `Ficheiro: ${csvName} · ${report.rows} linhas · responsável: ${owner.fullName}`,
    ``,
    `## Contagens no Notion`,
    `| Score | n | Status | n | Fonte | n |`,
    `|---|---:|---|---:|---|---:|`,
    ...Array.from({ length: Math.max(Object.keys(report.byScore).length, Object.keys(report.byStatus).length, Object.keys(report.bySource).length) }, (_, i) => {
      const s = Object.entries(report.byScore)[i], st = Object.entries(report.byStatus)[i], f = Object.entries(report.bySource)[i];
      return `| ${s?.[0] ?? ""} | ${s?.[1] ?? ""} | ${st?.[0] ?? ""} | ${st?.[1] ?? ""} | ${f?.[0] ?? ""} | ${f?.[1] ?? ""} |`;
    }),
    ``,
    `## Resultado`,
    `- Imóveis: ${report.properties.created} novos, ${report.properties.matchedDb} já existiam na app, ${report.properties.matchedInFile} repetidos dentro do ficheiro (vários negócios no mesmo imóvel)`,
    `- Contactos: ${report.contacts.created} novos, ${report.contacts.matched} reutilizados, ${report.contacts.skipped} linhas sem contacto`,
    `- Negócios: ${report.deals.created} ${APPLY ? "criados" : "a criar"}, ${report.deals.skipped} ignorados por já existirem`,
    `- Documentos: ${report.documents.attached} anexados${report.documents.missing.length ? `, ${report.documents.missing.length} em falta` : ""}`,
    ``,
    `## Avisos (${report.warnings.length})`,
    ...report.warnings.map((w) => `- ${w}`),
    ...(report.documents.missing.length ? [``, `## Ficheiros em falta`, ...report.documents.missing.map((m) => `- ${m}`)] : []),
    ``,
  ].join("\n");
  const out = path.join(process.cwd(), APPLY ? "import-report-applied.md" : "import-report.md");
  writeFileSync(out, md, "utf8");
  console.log(md.split("\n").slice(0, 30).join("\n"));
  console.log(`\n… relatório completo em ${out}`);
  if (!APPLY) console.log("\nDry-run: nada foi gravado. Repete com --apply para importar.");
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
