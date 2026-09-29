// Mostra contagens das tabelas base e as fases do pipeline.
import postgres from "postgres";
const sql = postgres(process.env.DIRECT_URL, { max: 1 });
const tables = ["organizations","profiles","role_permissions","deal_stages","source_channels","budget_categories","document_categories","tags","imt_brackets"];
for (const t of tables) {
  const [{ n }] = await sql`select count(*)::int as n from ${sql(t)}`;
  console.log(t.padEnd(22), n);
}
console.log("--- deal_stages ---");
for (const s of await sql`select sort, name, is_default, is_purchase from deal_stages order by sort`) {
  console.log(` ${s.sort}. ${s.name}${s.is_default ? "  (default)" : ""}${s.is_purchase ? "  (compra)" : ""}`);
}
await sql.end();
