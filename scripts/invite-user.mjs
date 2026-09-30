// Convida um utilizador por email (recebe link para definir password).
// Uso: pnpm user:invite <email> "<Nome Completo>" [admin|manager|user]
import { createClient } from "@supabase/supabase-js";

const [email, fullName, role = "user"] = process.argv.slice(2);
if (!email || !fullName) {
  console.log('Uso: pnpm user:invite <email> "<Nome Completo>" [admin|manager|user]');
  process.exit(1);
}
if (!["admin", "manager", "user"].includes(role)) {
  console.log("Papel inválido. Usa admin, manager ou user.");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// O link do email tem de apontar para produção (o .env.local não define NEXT_PUBLIC_APP_URL).
const appUrl = process.env.INVITE_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app.89.58.58.97.sslip.io";
const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { full_name: fullName, role },
  // Convites da API de admin devolvem a sessão no fragmento (#access_token=…),
  // que só o browser lê: /auth/callback trata disso.
  redirectTo: `${appUrl}/auth/callback?next=/reset-password/update`,
});
// process.exitCode em vez de process.exit(): sair à força com pedidos HTTP
// ainda a fechar dá "Assertion failed … UV_HANDLE_CLOSING" no Node em Windows.
if (error) {
  console.log("FALHOU:", error.message);
  process.exitCode = 1;
} else {
  console.log(`✓ convite enviado para ${email} (${role}). id: ${data.user.id}`);
  console.log(`  link de retorno: ${appUrl}/auth/callback`);
}
