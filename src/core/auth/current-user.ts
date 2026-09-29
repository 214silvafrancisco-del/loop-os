import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema";
import { createClient } from "./supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "manager" | "user";
  organizationId: string;
  avatarUrl: string | null;
  initials: string;
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
 * Utilizador autenticado + perfil. `cache` garante uma única leitura por
 * pedido, mesmo que vários componentes chamem esta função.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (!profile || !profile.isActive) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    organizationId: profile.organizationId,
    avatarUrl: profile.avatarUrl,
    initials: initialsOf(profile.fullName) || profile.email[0]!.toUpperCase(),
  };
});

/** Para páginas e actions que exigem sessão. Lança se não houver. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autenticado.");
  return user;
}
