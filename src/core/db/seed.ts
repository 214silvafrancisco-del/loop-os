/**
 * Seed inicial: organização LOOP Homes, permissões por papel e listas
 * configuráveis. Idempotente: pode correr várias vezes sem duplicar.
 *
 * Correr com: pnpm db:seed   (usa DIRECT_URL de .env.local)
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { ensureChecklistSetup } from "@/modules/checklists/setup";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL/DATABASE_URL não definida em .env.local");

const sql = postgres(url, { prepare: false, max: 1 });
const db = drizzle(sql, { schema });

const ORG_NAME = "LOOP Homes";

const DEAL_STAGES = [
  { name: "Leads", color: "#2E86C1", isDefault: true },
  { name: "Visita", color: "#F97B22" },
  { name: "Proposta", color: "#D64545" },
  { name: "Compra", color: "#2E9E5B", isPurchase: true },
];

const SOURCE_CHANNELS = [
  "Sites",
  "Consultor",
  "Proprietário",
  "Placa de rua",
  "Investidor",
  "Outro",
];

const BUDGET_CATEGORIES = [
  ["01", "Demolições e apoio de construção civil"],
  ["02", "Construção civil"],
  ["03", "Eletricidade"],
  ["04", "Canalizações"],
  ["05", "AVAC"],
  ["06", "Carpintaria"],
  ["07", "Caixilharia"],
  ["08", "Cozinha"],
  ["09", "Instalações sanitárias"],
  ["10", "Pavimentos"],
  ["11", "Pintura e pladur"],
  ["12", "Portas"],
  ["13", "Equipamentos"],
  ["14", "Mobiliário"],
  ["15", "Materiais"],
  ["16", "Logística"],
  ["99", "Outros"],
];

type DocEntity = (typeof schema.documentEntity.enumValues)[number];
const DOCUMENT_CATEGORIES: [string, string, DocEntity][] = [
  ["imovel", "Caderneta predial", "property"],
  ["imovel", "Certidão permanente", "property"],
  ["imovel", "Certidão matricial", "property"],
  ["imovel", "Licença de utilização", "property"],
  ["imovel", "Certificado energético", "property"],
  ["imovel", "Plantas", "property"],
  ["imovel", "Ficha técnica", "property"],
  ["imovel", "Fotografias", "property"],
  ["imovel", "Outros", "property"],
  ["juridico", "CPCV", "deal"],
  ["juridico", "Contrato de compra e venda", "deal"],
  ["juridico", "Procuração", "deal"],
  ["juridico", "Documentos dos proprietários", "deal"],
  ["juridico", "Proposta", "deal"],
  ["juridico", "Outros", "deal"],
  ["financeiro", "Avaliação", "deal"],
  ["financeiro", "Proposta bancária", "deal"],
  ["financeiro", "Simulação", "deal"],
  ["financeiro", "Financiamento", "deal"],
  ["financeiro", "Business Plan", "deal"],
  ["financeiro", "Fatura", "invoice"],
  ["financeiro", "Comprovativo de pagamento", "invoice"],
  ["financeiro", "Outros", "deal"],
  ["tecnico", "Levantamento", "project"],
  ["tecnico", "Projeto", "project"],
  ["tecnico", "Orçamento", "project"],
  ["tecnico", "Relatório", "project"],
  ["tecnico", "Auto de medição", "measurement_report"],
  ["tecnico", "Fotografias de obra", "project"],
  ["tecnico", "Outros", "project"],
  ["comercial", "Fotografias comerciais", "sale"],
  ["comercial", "Brochura", "sale"],
  ["comercial", "Estudo de mercado", "deal"],
  ["comercial", "Outros", "sale"],
];

// Tabelas de IMT 2026 (folha IMT do BP_Benficat4.xlsx). upper null = sem limite.
type Bracket = [lower: number, upper: number | null, rate: number, deduction: number];
const IMT_2026: Record<"hpp" | "hs", Bracket[]> = {
  hpp: [
    [0, 106346, 0, 0],
    [106346, 145470, 0.02, 2126.92],
    [145470, 198347, 0.05, 6491.02],
    [198347, 330539, 0.07, 10457.96],
    [330539, 666982, 0.08, 13763.35],
    [666982, 1150853, 0.06, 0],
    [1150853, null, 0.075, 0],
  ],
  hs: [
    [0, 106346, 0.01, 0],
    [106346, 145470, 0.02, 1063.46],
    [145470, 198347, 0.05, 5427.56],
    [198347, 330539, 0.07, 9394.5],
    [330539, 633931, 0.08, 12699.89],
    [633931, 1150853, 0.06, 0],
    [1150853, null, 0.075, 0],
  ],
};

const PERMISSIONS: Record<
  "admin" | "manager" | "user",
  { modules: string[]; view: boolean; create: boolean; edit: boolean; del: boolean; exp: boolean }[]
> = {
  admin: [
    {
      modules: ["deals", "properties", "projects", "invoices", "documents", "contacts", "settings", "users"],
      view: true, create: true, edit: true, del: true, exp: true,
    },
  ],
  manager: [
    {
      modules: ["deals", "properties", "projects", "invoices", "documents", "contacts"],
      view: true, create: true, edit: true, del: true, exp: true,
    },
    { modules: ["settings", "users"], view: true, create: false, edit: false, del: false, exp: false },
  ],
  user: [
    {
      modules: ["deals", "properties", "projects", "invoices", "documents", "contacts"],
      view: true, create: true, edit: true, del: false, exp: false,
    },
    { modules: ["settings", "users"], view: false, create: false, edit: false, del: false, exp: false },
  ],
};

async function main() {
  // 1. Organização
  let [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.name, ORG_NAME));
  if (!org) {
    [org] = await db
      .insert(schema.organizations)
      .values({
        name: ORG_NAME,
        settings: {
          proposalSignature: "LOOP Homes",
          defaultVatPct: 0.23,
          comparableAreaAdjPctPerM2: 0.0025,
          targetRoePct: 0.3,
          targetAnnualizedPct: 0.3,
        },
      })
      .returning();
    console.log("✓ organização criada:", org.id);
  } else {
    console.log("• organização já existe:", org.id);
  }
  const organizationId = org.id;

  // 2. Permissões
  for (const role of ["admin", "manager", "user"] as const) {
    for (const rule of PERMISSIONS[role]) {
      for (const moduleName of rule.modules) {
        await db
          .insert(schema.rolePermissions)
          .values({
            organizationId, role, module: moduleName,
            canView: rule.view, canCreate: rule.create, canEdit: rule.edit,
            canDelete: rule.del, canExport: rule.exp,
          })
          .onConflictDoNothing();
      }
    }
  }
  console.log("✓ permissões");

  // 3. Fases
  await db
    .insert(schema.dealStages)
    .values(DEAL_STAGES.map((s, i) => ({ organizationId, sort: i + 1, ...s })))
    .onConflictDoNothing();
  console.log("✓ fases:", DEAL_STAGES.length);

  // 4. Fontes
  await db
    .insert(schema.sourceChannels)
    .values(SOURCE_CHANNELS.map((name, i) => ({ organizationId, name, sort: i + 1 })))
    .onConflictDoNothing();
  console.log("✓ fontes:", SOURCE_CHANNELS.length);

  // 5. Categorias de orçamento
  await db
    .insert(schema.budgetCategories)
    .values(BUDGET_CATEGORIES.map(([code, name], i) => ({ organizationId, code, name, sort: i + 1 })))
    .onConflictDoNothing();
  console.log("✓ categorias de orçamento:", BUDGET_CATEGORIES.length);

  // 6. Categorias de documentos
  await db
    .insert(schema.documentCategories)
    .values(
      DOCUMENT_CATEGORIES.map(([group, name, defaultEntity], i) => ({
        organizationId, group, name, defaultEntity, sort: i + 1,
      })),
    )
    .onConflictDoNothing();
  console.log("✓ categorias de documentos:", DOCUMENT_CATEGORIES.length);

  // 7. IMT 2026
  const rows = (["hpp", "hs"] as const).flatMap((regime) =>
    IMT_2026[regime].map(([lower, upper, rate, deduction]) => ({
      organizationId, year: 2026, regime,
      lower: lower.toFixed(2),
      upper: upper === null ? null : upper.toFixed(2),
      rate: rate.toFixed(4),
      deduction: deduction.toFixed(2),
    })),
  );
  await db.insert(schema.imtBrackets).values(rows).onConflictDoNothing();
  console.log("✓ escalões IMT 2026:", rows.length);

  // 8. Procedimentos (checklists) e categorias de documento que usam
  const setup = await ensureChecklistSetup(organizationId);
  console.log("✓ procedimentos:", setup.createdTemplates.length ? setup.createdTemplates.join(", ") : "já existiam");
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error(err);
    await sql.end();
    process.exit(1);
  });
