import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/core/auth/supabase/server";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "Definir password" };

// Chega-se aqui a partir do link de convite ou de recuperação (já com sessão).
export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link");
  return <UpdatePasswordForm email={user.email ?? ""} />;
}
