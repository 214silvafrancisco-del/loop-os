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
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (!tokenHash && !code && !searchParams.get("error")) {
    return NextResponse.redirect(new URL(`/auth/callback?next=${encodeURIComponent(next)}`, request.url));
  }

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
