// Cria um utilizador já com password (sem email). A password é pedida no
// terminal, escondida, e não fica guardada em lado nenhum.
// Uso: pnpm user:create <email> "<Nome Completo>" [admin|manager|user]
import { createClient } from "@supabase/supabase-js";
import { stdin, stdout } from "node:process";

const [email, fullName, role = "user"] = process.argv.slice(2);
if (!email || !fullName) {
  console.log('Uso: pnpm user:create <email> "<Nome Completo>" [admin|manager|user]');
  process.exit(1);
}
if (!["admin", "manager", "user"].includes(role)) {
  console.log("Papel inválido. Usa admin, manager ou user.");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.exit(1);
      } else if (ch === "\u0008" || ch === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await askHidden("Password (mínimo 8 caracteres, não aparece ao escrever): ");
if (password.length < 8) {
  console.log("Password demasiado curta.");
  process.exit(1);
}
const confirm = await askHidden("Repete a password: ");
if (password !== confirm) {
  console.log("As passwords não coincidem.");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, role },
});
if (error) {
  console.log("FALHOU:", error.message);
  process.exit(1);
}
console.log(`✓ utilizador criado: ${email} (${role}). id: ${data.user.id}`);
