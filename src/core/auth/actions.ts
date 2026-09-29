"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "./supabase/server";

export type AuthFormState = { error?: string; ok?: boolean };

const loginSchema = z.object({
  email: z.email("Email inválido."),
  password: z.string().min(1, "Indica a password."),
  next: z.string().optional(),
});

async function appOrigin() {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`
  );
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "Email ou password incorretos." };

  const next = parsed.data.next;
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Email inválido." };

  const supabase = await createClient();
  const origin = await appOrigin();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password/update`,
  });
  // Resposta igual quer o email exista ou não (não revelar utilizadores).
  return { ok: true };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const schema = z
    .object({
      password: z.string().min(8, "Mínimo 8 caracteres."),
      confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, {
      message: "As passwords não coincidem.",
      path: ["confirm"],
    });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: "Não foi possível definir a password. Pede um novo link." };
  redirect("/dashboard");
}
