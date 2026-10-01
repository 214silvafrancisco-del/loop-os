import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { dealStages } from "@/modules/settings/schema";

/** Fase do negócio (para saber se é a de compra). */
export async function dealStageSettings(stageId: string): Promise<{ isPurchase: boolean } | null> {
  const [s] = await db.select({ isPurchase: dealStages.isPurchase }).from(dealStages).where(eq(dealStages.id, stageId));
  return s ?? null;
}
