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

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { full_name: fullName, role },
  redirectTo: `${appUrl}/auth/confirm?next=/reset-password/update`,
});
if (error) {
  console.log("FALHOU:", error.message);
  process.exit(1);
}
console.log(`✓ convite enviado para ${email} (${role}). id: ${data.user.id}`);
