"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase no browser. Só é usado para concluir links de email que
 * entregam a sessão no fragmento do URL (#access_token=…), que o servidor não
 * consegue ler. A sessão fica em cookies, partilhada com o servidor.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
