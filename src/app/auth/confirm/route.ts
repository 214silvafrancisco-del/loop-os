import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/core/auth/supabase/server";

/**
 * Destino dos links de email (convite, reset de password).
 * Suporta os dois formatos do Supabase:
 *  - ?token_hash=…&type=…   (templates de email configurados para SSR)
 *  - ?code=…                (fluxo PKCE por defeito)
 * Sem nenhum dos dois, o token vem no fragmento (#access_token=…), invisível
 * ao servidor: passa para /auth/callback (o browser mantém o fragmento).
 */
// request.url é o endereço interno do contentor (https://0.0.0.0:3000 em produção);
// request.nextUrl reconstrói o endereço público a partir dos cabeçalhos do proxy.
function to(request: NextRequest, pathWithQuery: string) {
  const url = request.nextUrl.clone();
  const [pathname, query = ""] = pathWithQuery.split("?");
  url.pathname = pathname;
  url.search = query ? `?${query}` : "";
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (!tokenHash && !code && !searchParams.get("error")) {
    return to(request, `/auth/callback?next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return to(request, next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return to(request, next);
  }

  return to(request, "/login?error=link");
}
