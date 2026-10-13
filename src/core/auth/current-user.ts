import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/core/db/client";
import { profiles, userModules } from "@/core/db/schema";
import { effectiveModules, hasModule, type AppModule } from "./access";
import { createClient } from "./supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "manager" | "user";
  organizationId: string;
  avatarUrl: string | null;
  initials: string;
  /** Módulos com acesso (o admin tem todos). */
  modules: AppModule[];
};

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * Utilizador autenticado + perfil + acessos. `cache` garante uma única leitura
 * por pedido, por isso as alterações na matriz têm efeito no pedido seguinte,
 * sem renovar sessão. Perfis desativados não entram.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (!profile || !profile.isActive) return null;
  const granted = profile.role === "admin" ? [] : (await db.select({ module: userModules.module }).from(userModules).where(eq(userModules.userId, profile.id))).map((r) => r.module);

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    organizationId: profile.organizationId,
    avatarUrl: profile.avatarUrl,
    initials: initialsOf(profile.fullName) || profile.email[0]!.toUpperCase(),
    modules: effectiveModules(profile.role, granted),
  };
});

/**
 * Para páginas e actions que exigem sessão. Com `module`, exige também acesso
 * a esse módulo: sem ele, redireciona para «sem acesso» (páginas e actions).
 */
export async function requireUser(module?: AppModule): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autenticado.");
  if (module && !hasModule(user, module)) redirect(`/sem-acesso?m=${module}`);
  return user;
}

/** Só o admin (Founder): administração, definições, matriz de acessos. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/sem-acesso?m=admin");
  return user;
}
