"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { dbErrorMessage } from "@/core/db/errors";
import { buildDigest } from "./digest";
import { formatDigest } from "./digest-format";
import { pushSubscriptions } from "./schema";
import { sendToUsers } from "./send";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(5).max(200) }),
  userAgent: z.string().max(300).optional(),
});
export type PushSubscriptionInput = z.input<typeof subscriptionSchema>;

/** Guarda (ou renova) a subscrição deste dispositivo para o utilizador com sessão. */
export async function savePushSubscription(input: PushSubscriptionInput): Promise<Result> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Subscrição inválida." };
  const { endpoint, keys, userAgent } = parsed.data;
  try {
    await db
      .insert(pushSubscriptions)
      .values({ organizationId: user.organizationId, userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent ?? null })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { organizationId: user.organizationId, userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent ?? null, lastSeenAt: new Date() },
      });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: dbErrorMessage(e) };
  }
}

/** Remove a subscrição deste dispositivo (o browser também a cancela do lado dele). */
export async function deletePushSubscription(endpoint: string): Promise<Result> {
  const user = await requireUser();
  try {
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: dbErrorMessage(e) };
  }
}

/** Notificação de teste só para os dispositivos do próprio utilizador. */
export async function sendTestNotification(): Promise<Result<{ sent: number }>> {
  const user = await requireUser();
  const r = await sendToUsers([user.id], { title: "LOOP OS", body: "As notificações estão ativas neste dispositivo.", url: "/settings", tag: "test" });
  if (r.sent === 0) return { ok: false, error: r.removed > 0 ? "A subscrição expirou. Ativa de novo." : "Nenhum dispositivo recebeu a notificação." };
  return { ok: true, sent: r.sent };
}

/** Envia já o resumo de hoje ao próprio utilizador (para ver como fica). */
export async function sendDigestPreview(): Promise<Result<{ sent: number; empty: boolean }>> {
  const user = await requireUser();
  const payload = formatDigest(await buildDigest(user.organizationId));
  if (!payload) return { ok: true, sent: 0, empty: true };
  const r = await sendToUsers([user.id], payload);
  return { ok: true, sent: r.sent, empty: false };
}
