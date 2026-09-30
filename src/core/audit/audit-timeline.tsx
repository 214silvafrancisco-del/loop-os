import { formatCurrency, formatDate } from "@/core/lib/format";
import type { AuditRow } from "./queries";

/** Mapas id → nome para traduzir chaves estrangeiras no histórico. */
export type AuditLookups = {
  stages?: Record<string, string>;
  users?: Record<string, string>;
  sources?: Record<string, string>;
  contacts?: Record<string, string>;
  /** código do item da checklist → label */
  checklistLabels?: Record<string, string>;
};

/** Nome com artigo definido, para frases como "atualizou a nota". */
const TABLE_LABEL: Record<string, string> = {
  properties: "o imóvel",
  deals: "o negócio",
  deal_notes: "a nota",
  contacts: "o contacto",
  projects: "a obra",
  documents: "o documento",
};

const FIELD_LABEL: Record<string, string> = {
  stage_id: "fase",
  status: "estado",
  owner_user_id: "responsável",
  name: "nome",
  next_action: "próxima ação",
  next_action_date: "data da próxima ação",
  asking_price: "preço pedido",
  target_price: "preço alvo",
  max_price: "preço máximo",
  estimated_works: "obra estimada",
  estimated_sale_price: "venda estimada",
  final_price: "valor final",
  cpcv_date: "data do CPCV",
  deed_date: "data da escritura",
  actual_acquisition_costs: "custos de aquisição",
  imt_resale_deadline: "prazo IMT",
  source_channel_id: "fonte",
  source_contact_id: "contacto",
  listing_url: "link do anúncio",
  source_commission_pct: "comissão",
  source_notes: "observações",
  entered_at: "data de entrada",
  excluded_at: "exclusão",
  address_line: "morada",
  postal_code: "código postal",
  parish: "freguesia",
  municipality: "concelho",
  district: "distrito",
  typology: "tipologia",
  gross_area: "área bruta",
  net_area: "área útil",
  floor: "piso",
  bedrooms: "quartos",
  bathrooms: "casas de banho",
  condition: "estado de conservação",
  construction_year: "ano",
  vpt: "VPT",
  is_aru: "zona ARU",
  property_type: "tipo",
  energy_class: "classe energética",
  has_elevator: "elevador",
  has_garage: "garagem",
  is_pinned: "fixada",
  body: "texto",
  phone: "telefone",
  email: "email",
  nif: "NIF",
  roles: "papéis",
  company_name: "empresa",
  notes: "notas",
  deleted_at: "eliminação",
  seq: "n.º",
  updated_by: "",
  created_by: "",
};

const MONEY = new Set(["asking_price", "target_price", "max_price", "estimated_works", "estimated_sale_price", "final_price", "actual_acquisition_costs", "vpt"]);
const DATES = new Set(["next_action_date", "cpcv_date", "deed_date", "imt_resale_deadline", "entered_at"]);
const STATUS_LABEL: Record<string, string> = { active: "ativo", excluded: "excluído", prospect: "prospeção", owned: "comprado", for_sale: "à venda", sold: "vendido" };

function fmt(field: string, value: unknown, lookups: AuditLookups): string {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY.has(field)) return formatCurrency(String(value));
  if (DATES.has(field)) return formatDate(String(value));
  if (field === "stage_id") return lookups.stages?.[String(value)] ?? "?";
  if (field === "owner_user_id") return lookups.users?.[String(value)] ?? "?";
  if (field === "source_channel_id") return lookups.sources?.[String(value)] ?? "?";
  if (field === "source_contact_id") return lookups.contacts?.[String(value)] ?? "?";
  if (field === "status") return STATUS_LABEL[String(value)] ?? String(value);
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  const s = String(value);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

const when = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" });

const CHECKLIST_STATUS: Record<string, string> = { pending: "pendente", done: "concluído", not_applicable: "não aplicável" };

/** Itens da checklist do processo: frases próprias, sem campos técnicos. */
function describeChecklistItem(e: AuditRow, lookups: AuditLookups): { title: string; details: string[] } | null {
  const nd = (e.newData ?? {}) as Record<string, unknown>;
  const od = (e.oldData ?? {}) as Record<string, unknown>;
  const code = String(nd.code ?? od.code ?? "");
  const label = lookups.checklistLabels?.[code] ?? code ?? "passo";
  if (e.action !== "update") return null;
  const fields = e.changedFields ?? [];
  const details: string[] = [];
  if (fields.includes("assignee_user_id")) {
    const who = nd.assignee_user_id ? (lookups.users?.[String(nd.assignee_user_id)] ?? "?") : "ninguém";
    if (!fields.includes("status")) return { title: `atribuiu "${label}" a ${who}`, details: [] };
    details.push(`responsável: ${who}`);
  }
  if (!fields.includes("status")) {
    if (fields.includes("na_note")) return { title: `alterou a nota de "${label}"`, details: [] };
    return null; // só detalhe/contadores
  }
  const status = String(nd.status);
  const auto = nd.source === "auto";
  if (status === "done") return { title: `${auto ? "concluiu automaticamente" : "concluiu"} "${label}"`, details };
  if (status === "not_applicable") {
    const note = nd.na_note ? [`nota: ${String(nd.na_note)}`] : [];
    return { title: `${nd.source === "context" ? "deixou de se aplicar" : "marcou como não aplicável"}: "${label}"`, details: [...note, ...details] };
  }
  return { title: `${auto ? "voltou a pendente (dados alterados)" : "repôs como pendente"}: "${label}"`, details: [...details, `antes: ${CHECKLIST_STATUS[String(od.status)] ?? od.status}`] };
}

function describe(e: AuditRow, lookups: AuditLookups): { title: string; details: string[] } | null {
  if (e.tableName === "checklist_items") return describeChecklistItem(e, lookups);
  const table = TABLE_LABEL[e.tableName] ?? e.tableName;
  const nd = (e.newData ?? {}) as Record<string, unknown>;
  const od = (e.oldData ?? {}) as Record<string, unknown>;

  if (e.action === "insert") {
    if (e.tableName === "deal_notes") return { title: "adicionou uma nota", details: [fmt("body", nd.body, lookups)] };
    const name = (nd.name ?? nd.address_line ?? nd.ref ?? "") as string;
    return { title: `criou ${table}${name ? ` "${name}"` : ""}`, details: [] };
  }
  if (e.action === "delete") {
    return { title: `apagou ${table}`, details: [] };
  }
  const fields = (e.changedFields ?? []).filter((f) => FIELD_LABEL[f] !== "");
  if (fields.length === 1 && fields[0] === "stage_id") {
    return { title: `mudou a fase: ${fmt("stage_id", od.stage_id, lookups)} → ${fmt("stage_id", nd.stage_id, lookups)}`, details: [] };
  }
  if (fields.includes("status") && e.tableName === "deals") {
    return { title: nd.status === "excluded" ? "excluiu o negócio" : "reativou o negócio", details: [] };
  }
  if (fields.length === 0) return { title: `atualizou ${table}`, details: [] };
  const details = fields.map((f) => `${FIELD_LABEL[f] ?? f}: ${fmt(f, od[f], lookups)} → ${fmt(f, nd[f], lookups)}`);
  return { title: `atualizou ${table}`, details };
}

export function AuditTimeline({ entries, lookups = {} }: { entries: AuditRow[]; lookups?: AuditLookups }) {
  if (entries.length === 0) {
    return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Sem histórico.</p>;
  }
  return (
    <ol className="relative ml-2 border-l">
      {entries.map((e) => {
        const d = describe(e, lookups);
        if (!d) return null;
        const { title, details } = d;
        return (
          <li key={e.id} className="mb-5 ml-4">
            <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-background bg-muted-foreground/60" />
            <div className="text-xs text-muted-foreground">{when.format(e.at)}</div>
            <div className="text-sm">
              <span className="font-medium">{e.userName ?? "Sistema"}</span> {title}
            </div>
            {details.length ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                {details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
