import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/core/db/client";
import { pushSubscriptions } from "./schema";

/** Conteúdo de uma notificação. O service worker (`public/sw.js`) lê este JSON. */
export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** As chaves VAPID vivem no ambiente (.env.local / Coolify). Sem elas não há envio. */
export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let vapidSet = false;
function ensureVapid(): boolean {
  if (!pushConfigured()) return false;
  if (!vapidSet) {
    const subject = process.env.VAPID_SUBJECT ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://loophomes.pt";
    webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    vapidSet = true;
  }
  return true;
}

export type SendResult = { sent: number; failed: number; removed: number };

/**
 * Envia a mesma notificação a todos os dispositivos dos utilizadores indicados.
 * Subscrições expiradas (404/410) são apagadas; outros erros ficam no log.
 */
export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, removed: 0 };
  if (userIds.length === 0 || !ensureVapid()) return result;
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  const body = JSON.stringify(payload);
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 12 * 60 * 60 });
      result.sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        result.removed++;
      } else {
        result.failed++;
        console.error("[push] envio falhou", { subscription: s.id, status, message: (e as Error).message });
      }
    }
  }
  return result;
}
