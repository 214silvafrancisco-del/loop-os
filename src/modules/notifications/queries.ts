import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { pushSubscriptions } from "./schema";
import { pushConfigured, vapidPublicKey } from "./send";

export type PushStatus = {
  /** Há chaves VAPID no servidor; sem elas o botão fica desativado. */
  configured: boolean;
  publicKey: string | null;
  /** Dispositivos deste utilizador com notificações ativas. */
  deviceCount: number;
};

export async function getPushStatus(userId: string): Promise<PushStatus> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return { configured: pushConfigured(), publicKey: vapidPublicKey(), deviceCount: row?.n ?? 0 };
}
