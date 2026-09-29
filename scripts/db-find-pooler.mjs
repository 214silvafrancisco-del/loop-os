// Descobre o host do pooler Supabase (IPv4) a partir do URL direto em .env.local.
import postgres from "postgres";
const direct = new URL(process.env.DIRECT_URL);
const ref = direct.hostname.split(".")[1]; // db.<ref>.supabase.co
const password = decodeURIComponent(direct.password);
const regions = ["eu-west-1","eu-central-1","eu-west-2","eu-west-3","eu-north-1","eu-central-2","eu-south-1","us-east-1"];
const hosts = regions.flatMap(r => [`aws-0-${r}.pooler.supabase.com`, `aws-1-${r}.pooler.supabase.com`]);
for (const host of hosts) {
  const sql = postgres({ host, port: 5432, database: "postgres", username: `postgres.${ref}`, password, max: 1, connect_timeout: 8, ssl: "require" });
  try {
    await sql`select 1`;
    console.log("ENCONTRADO:", host);
    await sql.end();
    process.exit(0);
  } catch (e) {
    const m = String(e.message);
    console.log("  x", host, "->", e.code ?? "", m.length > 60 ? m.slice(0, 60) + "…" : m);
    await sql.end().catch(() => {});
  }
}
console.log("NENHUM host respondeu");
process.exit(2);
