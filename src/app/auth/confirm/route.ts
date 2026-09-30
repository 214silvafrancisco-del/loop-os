import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/core/auth/supabase/server";
import { publicUrl } from "@/core/lib/public-url";

/**
 * Destino dos links de email (convite, reset de password).
 * Suporta os dois formatos do Supabase:
 *  - ?token_hash=…&type=…   (templates de email configurados para SSR)
 *  - ?code=…                (fluxo PKCE por defeito)
 * Sem nenhum dos dois, o token vem no fragmento (#access_token=…), invisível
 * ao servidor: passa para /auth/callback (o browser mantém o fragmento).
 */
function to(request: NextRequest, pathWithQuery: string) {
  return NextResponse.redirect(publicUrl(request, pathWithQuery));
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
