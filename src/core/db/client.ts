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

function createConnection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida (ver .env.example).");
  return postgres(url, { prepare: false, max: 10 });
}

const conn = globalForDb.pgConn ?? createConnection();
if (process.env.NODE_ENV !== "production") globalForDb.pgConn = conn;

export const db = drizzle(conn, { schema });
export type Db = typeof db;
