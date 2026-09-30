import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Cliente Drizzle partilhado. Em desenvolvimento o Next.js recarrega módulos a
 * cada alteração; guardar a ligação em `globalThis` evita abrir dezenas de
 * ligações ao Postgres.
 *
 * DATABASE_URL aponta para o pooler do Supabase em modo transação (porta 6543),
 * por isso `prepare: false`.
 */
const globalForDb = globalThis as unknown as { pgConn?: postgres.Sql };

/**
 * O postgres-js só abre ligação na primeira query. Durante o `next build`
 * (Docker, sem segredos) os módulos são importados mas nenhuma query corre,
 * por isso aceitamos a ausência de DATABASE_URL e usamos um endereço inválido:
 * qualquer query sem a variável falha com um erro claro em runtime.
 */
function createConnection() {
  const url = process.env.DATABASE_URL;
  if (!url && process.env.NEXT_PHASE !== "phase-production-build") {
    console.error("[db] DATABASE_URL não definida (ver .env.example).");
  }
  return postgres(url ?? "postgres://missing-database-url@127.0.0.1:1/none", { prepare: false, max: 10 });
}

const conn = globalForDb.pgConn ?? createConnection();
if (process.env.NODE_ENV !== "production") globalForDb.pgConn = conn;

export const db = drizzle(conn, { schema });
export type Db = typeof db;
