"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { dbErrorMessage } from "@/core/db/errors";
import { getSuggestedCounts } from "./queries";
import { funnelWeeks } from "./schema";
import { weekStartOf } from "./weeks";

type Result = { ok: true } | { ok: false; error: string };

/** "" → null (por preencher); "0" → 0; inteiros ≥ 0. */
const count = z
  .union([z.string(), z.number(), z.null()])
  .transform((v, ctx) => {
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (!Number.isInteger(n) || n < 0 || n > 100000) {
      ctx.addIssue({ code: "custom", message: "Número inteiro ≥ 0." });
      return z.NEVER;
    }
    return n;
  });

const weekSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  leads: count,
  visits: count,
  proposals: count,
  purchases: count,
  notes: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
});
export type FunnelWeekInput = z.input<typeof weekSchema>;

/** Grava (ou cria) o registo de uma semana. A semana é normalizada para a segunda-feira. */
export async function saveFunnelWeek(input: FunnelWeekInput): Promise<Result> {
  const user = await requireUser();
  const parsed = weekSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const weekStart = weekStartOf(d.weekStart);
  if (weekStart > weekStartOf(new Date().toISOString().slice(0, 10))) return { ok: false, error: "Não se registam semanas futuras." };
  try {
    await db
      .insert(funnelWeeks)
      .values({ organizationId: user.organizationId, weekStart, leads: d.leads, visits: d.visits, proposals: d.proposals, purchases: d.purchases, notes: d.notes ?? null, createdBy: user.id, updatedBy: user.id })
      .onConflictDoUpdate({
        target: [funnelWeeks.organizationId, funnelWeeks.weekStart],
        set: { leads: d.leads, visits: d.visits, proposals: d.proposals, purchases: d.purchases, notes: d.notes ?? null, updatedBy: user.id },
      });
  } catch (e) {
    return { ok: false, error: dbErrorMessage(e) };
  }
  revalidatePath("/dashboard");
  revalidatePath("/funil");
  return { ok: true };
}

/** Preenche a semana com os valores sugeridos pela app (substitui o que lá estiver). */
export async function applySuggestedFunnelWeek(weekStart: string): Promise<Result> {
  const user = await requireUser();
  const s = await getSuggestedCounts(user.organizationId, weekStartOf(weekStart));
  return saveFunnelWeek({ weekStart, leads: s.leads, visits: s.visits, proposals: s.proposals, purchases: s.purchases });
}

/** Apaga o registo de uma semana (volta a «por preencher»). */
export async function deleteFunnelWeek(weekStart: string): Promise<Result> {
  const user = await requireUser();
  await db.delete(funnelWeeks).where(and(eq(funnelWeeks.organizationId, user.organizationId), eq(funnelWeeks.weekStart, weekStartOf(weekStart))));
  revalidatePath("/dashboard");
  revalidatePath("/funil");
  return { ok: true };
}
