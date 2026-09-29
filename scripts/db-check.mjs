// Testa a ligação à base de dados sem imprimir credenciais.
import postgres from "postgres";
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) { console.log("FALHOU: DIRECT_URL não definida"); process.exit(1); }
const sql = postgres(url, { max: 1, connect_timeout: 15 });
try {
  const [r] = await sql`select version() as v, current_database() as db`;
  console.log("OK:", r.db, "|", r.v.split(",")[0]);
} catch (e) {
  console.log("FALHOU:", e.code ?? "", e.message);
} finally { await sql.end(); }
