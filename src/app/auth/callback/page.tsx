"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/core/auth/supabase/browser";

/**
 * Destino dos links de email por defeito do Supabase (convite, recuperação,
 * magic link). Esses links devolvem a sessão no fragmento do URL
 * (#access_token=…&refresh_token=…&type=invite) ou um `?code=` (PKCE).
 * Esta página guarda a sessão em cookies e segue para o passo seguinte.
 */
function safeNext(raw: string | null, type: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return type === "invite" || type === "recovery" ? "/reset-password/update" : "/dashboard";
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = hash.get("type") ?? search.get("type");
    const next = safeNext(search.get("next"), type);

    const fail = (message: string) => setError(message);

    const errorDescription = hash.get("error_description") ?? search.get("error_description");
    if (errorDescription) {
      fail(/expired/i.test(errorDescription) ? "O link expirou. Pede um novo convite ou uma nova recuperação de password." : errorDescription);
      return;
    }

    (async () => {
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = search.get("code");
      if (accessToken && refreshToken) {
        const { error: e } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (e) return fail("Não foi possível validar o link. Pede um novo.");
      } else if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        if (e) return fail("Não foi possível validar o link. Pede um novo.");
      } else {
        return fail("Link inválido ou incompleto.");
      }
      // Recarregamento completo para o servidor ler os cookies da sessão.
      window.location.replace(next);
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center text-sm">
        {error ? (
          <>
            <p className="mb-4 text-destructive">{error}</p>
            <Link href="/login" className="font-medium text-primary hover:underline">
              Voltar ao login
            </Link>
          </>
        ) : (
          <p className="text-muted-foreground">A validar o link…</p>
        )}
      </div>
    </div>
  );
}
