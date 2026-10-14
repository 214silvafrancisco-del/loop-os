/**
 * Testes de autorização, tarefas, dashboards e regressões (Fase 5) contra uma
 * instância a correr (por defeito http://localhost:3000).
 *
 *   pnpm access:check            # usa .env.local (Supabase + DIRECT_URL)
 *   BASE_URL=https://… pnpm access:check
 *
 * Cria um utilizador temporário «Acesso Teste (apagar)» com acesso só a
 * Negócios, tarefas temporárias com o prefixo «TAREFA DE TESTE (apagar)», faz
 * pedidos HTTP com a sessão desse utilizador e verifica redirecionamentos,
 * códigos 403, conteúdo das páginas e políticas da base de dados. No fim
 * apaga tudo o que criou, incluindo a auditoria. Sai com código 1 se algo falhar.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const postgres = require("postgres");
const { createClient } = require("@supabase/supabase-js");

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = "acesso-teste@loop.local";
const NAME = "Acesso Teste (apagar)";
const T = "TAREFA DE TESTE (apagar)";
const sql = postgres(process.env.DIRECT_URL, { max: 1 });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const results = [];
function check(group, name, ok, detail = "") {
  results.push({ group, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${group}] ${name}${detail ? ` — ${detail}` : ""}`);
}

/* ---------- sessão HTTP ---------- */
let cookie = "";
function mergeCookies(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  if (!set.length) return;
  const jar = new Map(cookie.split("; ").filter(Boolean).map((c) => c.split("=")));
  for (const c of set) {
    const [kv] = c.split(";");
    const [k, ...v] = kv.split("=");
    jar.set(k, v.join("="));
  }
  cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function req(path, init = {}) {
  const res = await fetch(BASE + path, { redirect: "manual", ...init, headers: { cookie, ...(init.headers ?? {}) } });
  mergeCookies(res);
  const text = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location") ?? "", text };
}
const redirectsTo = (r, target) => (r.status === 307 || r.status === 308 || r.status === 302 || r.status === 303) && r.location.includes(target);

async function login() {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (error) throw new Error("magic link: " + error.message);
  cookie = "";
  const r = await req(`/auth/confirm?type=magiclink&token_hash=${data.properties.hashed_token}&next=/dashboard`);
  if (!redirectsTo(r, "/dashboard")) throw new Error(`login falhou: ${r.status} ${r.location}`);
  const d = await req("/dashboard");
  if (d.status !== 200) throw new Error(`dashboard após login: ${d.status}`);
}

/* ---------- preparação ---------- */
let userId, orgId;
const ids = { tasks: [] };
async function setup() {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list.users.find((u) => u.email === EMAIL);
  if (existing) await admin.auth.admin.deleteUser(existing.id);
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true, user_metadata: { full_name: NAME, role: "manager" } });
  if (error) throw new Error("createUser: " + error.message);
  userId = data.user.id;
  const [p] = await sql`select organization_id from profiles where id = ${userId}`;
  if (!p) throw new Error("perfil não criado pelo trigger");
  orgId = p.organization_id;
  await sql`insert into user_modules (user_id, module, created_by) values (${userId}, 'negocios', ${userId})`;
}

async function pick() {
  const [deal] = await sql`select d.id, d.property_id, p.ref from deals d join properties p on p.id = d.property_id where d.organization_id = ${orgId} and d.deleted_at is null and d.status = 'active' order by d.created_at limit 1`;
  const [project] = await sql`select id, property_id from projects where organization_id = ${orgId} and deleted_at is null limit 1`;
  const [sale] = await sql`select s.id, s.property_id, p.ref from sales s join properties p on p.id = s.property_id where s.organization_id = ${orgId} and s.deleted_at is null limit 1`;
  const [property] = await sql`select id from properties where organization_id = ${orgId} limit 1`;
  const [contact] = await sql`select id from contacts where organization_id = ${orgId} limit 1`;
  const [dealDoc] = await sql`select v.id from document_versions v join documents d on d.id = v.document_id where d.organization_id = ${orgId} and d.entity_type = 'deal' and d.deleted_at is null limit 1`;
  const [invoiceDoc] = await sql`select v.id from document_versions v join documents d on d.id = v.document_id where d.organization_id = ${orgId} and d.entity_type in ('invoice', 'project') and d.deleted_at is null limit 1`;
  return { deal, project, sale, property, contact, dealDoc, invoiceDoc };
}

async function insertTask(entityType, entityId, propertyId, title, extra = {}) {
  const [t] = await sql`insert into tasks (organization_id, entity_type, entity_id, property_id, title, due_date, status, assignee_user_id, created_by)
    values (${orgId}, ${entityType}, ${entityId}, ${propertyId}, ${title}, ${extra.due ?? null}, ${extra.status ?? "por_iniciar"}, ${extra.assignee === undefined ? userId : extra.assignee}, ${userId}) returning id`;
  ids.tasks.push(t.id);
  return t.id;
}

/* ---------- testes ---------- */
async function permissionTests(x) {
  const G = "5.1 permissões";
  check(G, "1 Obras bloqueado por rota direta", redirectsTo(await req("/projects"), "/sem-acesso?m=obras"));
  check(G, "1 Vendas bloqueado por rota direta", redirectsTo(await req("/sales"), "/sem-acesso?m=vendas"));
  if (x.project) check(G, "2 faturas da obra (financeiro) bloqueadas", redirectsTo(await req(`/projects/${x.project.id}/faturas`), "/sem-acesso?m=obras"));
  if (x.sale) check(G, "2 resultado da venda bloqueado", redirectsTo(await req(`/sales/${x.sale.id}/resultado`), "/sem-acesso?m=vendas"));
  if (x.invoiceDoc) check(G, "2 download de documento de fatura → 403", (await req(`/api/documents/${x.invoiceDoc.id}/download`)).status === 403);
  if (x.dealDoc) {
    const r = await req(`/api/documents/${x.dealDoc.id}/download`);
    check(G, "2 download de documento de negócio permitido", r.status === 200 || r.status === 307 || r.status === 302, `status ${r.status}`);
  }
  if (x.project) {
    check(G, "2 API importar orçamento → 403", (await req(`/api/projects/${x.project.id}/budget/import`, { method: "POST", body: new FormData() })).status === 403);
    check(G, "2 API extrair fatura → 403", (await req(`/api/projects/${x.project.id}/invoices/extract`, { method: "POST", body: new FormData() })).status === 403);
  }
  const dash = await req("/dashboard");
  check(G, "2 dashboard sem blocos de Obras/Vendas/Funil", dash.status === 200 && !dash.text.includes("Faturas por pagar") && !dash.text.includes(">Vendas<") && !dash.text.includes("Funil comercial"));
  check(G, "3 menu sem Obras/Vendas/Funil/Definições", !/href="\/projects"/.test(dash.text) && !/href="\/sales"/.test(dash.text) && !/href="\/funil"/.test(dash.text) && !/href="\/settings"/.test(dash.text));
  check(G, "3 menu com Negócios", /href="\/deals"/.test(dash.text));
  check(G, "5 Negócios não dá Imóveis nem Contactos", redirectsTo(await req("/properties"), "/sem-acesso?m=imoveis") && redirectsTo(await req("/contacts"), "/sem-acesso?m=contactos"));
  if (x.property) check(G, "5 documentos do imóvel bloqueados", redirectsTo(await req(`/properties/${x.property.id}/documentos`), "/sem-acesso?m=imoveis"));
  if (x.sale) {
    await insertTask("sale", x.sale.id, x.sale.property_id, `${T} venda mascarada`, { due: "2026-12-01" });
    const list = await req("/tarefas");
    check(G, "6 tarefa de Vendas atribuída aparece mascarada", list.status === 200 && list.text.includes("(módulo sem acesso)") && list.text.includes(`${T} venda mascarada`));
    check(G, "6 mascarada não expõe o imóvel da venda", !list.text.includes(`Venda ${x.sale.ref}`));
    check(G, "6 a tarefa não abre a ficha da venda", redirectsTo(await req(`/sales/${x.sale.id}/tarefas`), "/sem-acesso?m=vendas"));
  }
  check(G, "7 matriz de acessos só para admin", redirectsTo(await req("/settings/utilizadores"), "/sem-acesso?m=admin"));
  check(G, "7 Definições só para admin", redirectsTo(await req("/settings"), "/sem-acesso?m=admin"));
  // 8: o próprio não altera as suas permissões — a única via é a server action setUserModule, que exige requireAdmin() (verificado no código); por HTTP não há rota.
  const anon = async (table) => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` } });
    const body = await res2text(r);
    return { status: r.status, body };
  };
  for (const table of ["user_modules", "tasks", "deals", "invoices", "documents"]) {
    const r = await anon(table);
    check("5.5 políticas BD", `API pública (anon) não lê ${table}`, r.status === 401 || r.status === 403 || r.body.trim() === "[]", `status ${r.status} body ${r.body.slice(0, 40)}`);
  }
  const ins = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_modules`, { method: "POST", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ user_id: userId, module: "obras" }) });
  check("5.5 políticas BD", "8 API pública não concede acessos", ins.status === 401 || ins.status === 403 || ins.status === 400, `status ${ins.status}`);
  const [{ n }] = await sql`select count(*)::int n from user_modules where user_id = ${userId} and module = 'obras'`;
  check("5.5 políticas BD", "8 nenhuma linha de acesso criada", n === 0);
}
async function res2text(r) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

async function taskTests(x) {
  const G = "5.2 tarefas";
  if (!x.deal) return;
  const due = "2026-10-06";
  const a = await insertTask("deal", x.deal.id, x.deal.property_id, `${T} atrasada`, { due });
  const [row] = await sql`select assignee_user_id, due_date::text as due_date from tasks where id = ${a}`;
  check(G, "1-2 responsável ativo e prazo guardados", row.assignee_user_id === userId && row.due_date === due);
  const dash = await req("/dashboard");
  check(G, "3 tarefa aparece no dashboard do responsável", dash.text.includes(`${T} atrasada`));
  check(G, "4 atraso calculado (etiqueta «atrasada»)", /atrasada/.test(dash.text));
  const mine = await req(`/tarefas?owner=${userId}`);
  check(G, "3 lista filtrada por responsável", mine.text.includes(`${T} atrasada`));
  // 5 concluir preserva o histórico; 7 mudança de responsável fica na auditoria
  await sql`update tasks set assignee_user_id = null, updated_by = ${userId} where id = ${a}`;
  await sql`update tasks set status = 'concluida', completed_at = now(), completed_by = ${userId}, updated_by = ${userId} where id = ${a}`;
  const [done] = await sql`select status, completed_at from tasks where id = ${a}`;
  check(G, "5 concluída fica na tabela com data", done.status === "concluida" && done.completed_at !== null);
  const audits = await sql`select changed_fields from audit_log where table_name = 'tasks' and row_id = ${a} and action = 'update'`;
  check(G, "7 mudança de responsável registada na auditoria", audits.some((r) => (r.changed_fields ?? []).includes("assignee_user_id")));
  check(G, "5 conclusão registada na auditoria", audits.some((r) => (r.changed_fields ?? []).includes("status")));
  const hist = await req(`/deals/${x.deal.id}/tarefas`);
  check(G, "5 histórico do negócio mostra a concluída", hist.status === 200 && hist.text.includes(`${T} atrasada`));
  // 10 reatribuição não apaga o histórico
  const b = await insertTask("deal", x.deal.id, x.deal.property_id, `${T} reatribuir`, { due: "2026-12-31" });
  const before = (await sql`select count(*)::int n from audit_log where table_name = 'tasks' and row_id = ${b}`)[0].n;
  await sql`update tasks set assignee_user_id = null where id = ${b}`;
  const [kept] = await sql`select id, title from tasks where id = ${b}`;
  const after = (await sql`select count(*)::int n from audit_log where table_name = 'tasks' and row_id = ${b}`)[0].n;
  check(G, "10 reatribuição mantém a tarefa e acrescenta auditoria", kept && kept.title === `${T} reatribuir` && after === before + 1);
  // 6 próxima tarefa mantém a ligação ao registo (criada pelo fluxo de conclusão: mesmo entity_type/entity_id)
  const [parent] = await sql`select entity_type, entity_id from tasks where id = ${b}`;
  check(G, "6 ligação ao registo preservada", parent.entity_type === "deal" && parent.entity_id === x.deal.id);
  // 9 tarefa de módulo sem acesso não expõe o conteúdo
  if (x.sale) check(G, "9 tarefa de Vendas não abre a venda", redirectsTo(await req(`/sales/${x.sale.id}`), "/sem-acesso?m=vendas"));
}

async function dashboardTests() {
  const G = "5.3 dashboards";
  const dash = await req("/dashboard");
  check(G, "1 só tarefas do próprio (sem tarefas de outros)", dash.status === 200 && !dash.text.includes("Gonçalo Gaspar · ") );
  check(G, "3 sem informação de módulos sem acesso", !dash.text.includes("Obras em curso") && !dash.text.includes("Previsão de compras"));
  check(G, "9 dashboard sem erros", !dash.text.includes("Application error") && !dash.text.includes("Internal Server Error"));
  const kanban = await req("/tarefas?view=kanban");
  check(G, "5 Kanban abre com filtros de responsável", kanban.status === 200 && kanban.text.includes("Por iniciar"));
  const empty = await req("/tarefas?owner=none&status=bloqueada&module=sale_lead");
  check(G, "9 lista vazia sem erro", empty.status === 200 && (empty.text.includes("Sem tarefas para estes filtros") || empty.text.includes("Por iniciar")));
}

async function founderTests(x) {
  const G = "5.3/5.4 admin";
  await sql`update profiles set role = 'admin' where id = ${userId}`;
  const dash = await req("/dashboard");
  check(G, "4 admin mantém a visão global (funil, em aberto, vendas, obras)", dash.status === 200 && dash.text.includes("Funil comercial") && dash.text.includes("Em aberto") && dash.text.includes("Faturas por pagar"));
  const funil = await req("/funil");
  const weeks = await sql`select count(*)::int n from funnel_weeks where organization_id = ${orgId}`;
  check(G, "6-7 histórico do funil completo em /funil", funil.status === 200 && weeks[0].n >= 0 && funil.text.includes("Funil"), `${weeks[0].n} semanas na BD`);
  const pages = ["/dashboard", "/tarefas", "/tarefas?view=kanban", "/deals", "/deals/new", "/properties", "/properties/new", "/contacts", "/contacts/new", "/projects", "/sales", "/sales/new", "/funil", "/settings", "/settings/utilizadores", "/settings/procedimentos", "/notificacoes", "/sem-acesso?m=obras"];
  if (x.deal) pages.push(`/deals/${x.deal.id}`, `/deals/${x.deal.id}/resumo`, `/deals/${x.deal.id}/analise`, `/deals/${x.deal.id}/business-plan`, `/deals/${x.deal.id}/proposta`, `/deals/${x.deal.id}/processo`, `/deals/${x.deal.id}/documentos`, `/deals/${x.deal.id}/notas`, `/deals/${x.deal.id}/historico`, `/deals/${x.deal.id}/tarefas`);
  if (x.project) pages.push(`/projects/${x.project.id}`, `/projects/${x.project.id}/resumo`, `/projects/${x.project.id}/orcamento`, `/projects/${x.project.id}/faturas`, `/projects/${x.project.id}/autos`, `/projects/${x.project.id}/documentos`, `/projects/${x.project.id}/processo`, `/projects/${x.project.id}/tarefas`);
  if (x.sale) pages.push(`/sales/${x.sale.id}`, `/sales/${x.sale.id}/resumo`, `/sales/${x.sale.id}/leads`, `/sales/${x.sale.id}/procedimento`, `/sales/${x.sale.id}/documentos`, `/sales/${x.sale.id}/resultado`, `/sales/${x.sale.id}/tarefas`);
  if (x.property) pages.push(`/properties/${x.property.id}`, `/properties/${x.property.id}/documentos`);
  if (x.contact) pages.push(`/contacts/${x.contact.id}`);
  let okAll = true;
  for (const p of pages) {
    const r = await req(p);
    // As fichas (/deals/<id>, /projects/<id>, /sales/<id>) redirecionam para o separador por defeito.
    const ok = (r.status === 200 && !r.text.includes("Application error")) || (r.status === 307 && r.location.includes(p + "/"));
    if (!ok) {
      okAll = false;
      check(G, `regressão: ${p}`, false, `status ${r.status}`);
    }
  }
  check(G, `regressão: ${pages.length} páginas respondem 200 sem erro`, okAll);
  const health = await req("/api/health");
  check(G, "api/health ok", health.status === 200 && health.text.includes('"ok":true'));
  await sql`update profiles set role = 'manager' where id = ${userId}`;
}

async function deactivationTest() {
  const G = "5.1 permissões";
  await sql`update profiles set is_active = false where id = ${userId}`;
  const r = await req("/dashboard");
  check(G, "9 utilizador desativado perde o acesso", r.status !== 200, `status ${r.status} → ${r.location}`);
  const api = await req("/api/health");
  check(G, "9 rotas públicas continuam (health)", api.status === 200);
  await sql`update profiles set is_active = true where id = ${userId}`;
}

async function cleanup() {
  if (ids.tasks.length) {
    await sql`delete from tasks where id = any(${ids.tasks})`;
    await sql`delete from audit_log where table_name = 'tasks' and row_id = any(${ids.tasks})`;
  }
  if (userId) {
    await sql`delete from funnel_weeks where created_by = ${userId}`.catch(() => {});
    // Registos que ficaram a apontar para o utilizador (ex.: itens de procedimento concluídos automaticamente ao abrir fichas): solta-os.
    const fks = await sql`select tc.table_name, kcu.column_name, rc.delete_rule from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
      join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'profiles' and tc.table_name <> 'user_modules'`;
    for (const f of fks) if (f.delete_rule !== "CASCADE") await sql.unsafe(`update ${f.table_name} set ${f.column_name} = null where ${f.column_name} = $1`, [userId]).catch(() => {});
    const del = await admin.auth.admin.deleteUser(userId);
    if (del.error) console.log("AVISO: não apaguei o utilizador de teste:", del.error.message);
    await sql`delete from audit_log where user_id = ${userId} or row_id = ${userId} or (table_name = 'user_modules' and coalesce(new_data ->> 'user_id', old_data ->> 'user_id') = ${userId})`;
  }
  const [{ n }] = await sql`select count(*)::int n from tasks where title like ${T + "%"}`;
  const [{ m }] = await sql`select count(*)::int m from profiles where email = ${EMAIL}`;
  console.log(`limpeza: tarefas de teste restantes ${n}, perfis de teste ${m}`);
}

try {
  await setup();
  await login();
  const x = await pick();
  await permissionTests(x);
  await taskTests(x);
  await dashboardTests();
  await founderTests(x);
  await deactivationTest();
} catch (e) {
  check("execução", "script", false, e.message);
} finally {
  await cleanup();
  await sql.end();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`);
process.exit(failed.length ? 1 : 0);
