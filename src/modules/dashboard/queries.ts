import "server-only";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { auditLog } from "@/core/db/schema/audit";
import { deals } from "@/modules/deals/schema";
import { proposals } from "@/modules/proposals/schema";

export type WeekStats = { newLeads: number; proposals: number; purchases: number };

/**
 * Performance da semana: negócios entrados, propostas geradas e compras
 * (negócios que passaram a Compra, pela auditoria, ou com escritura na semana).
 */
export async function getWeekStats(organizationId: string, weekStart: string, purchaseStageId: string | null): Promise<WeekStats> {
  const since = new Date(weekStart + "T00:00:00");
  const [[leads], [props], [moved], [deeded]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(deals)
      .where(and(eq(deals.organizationId, organizationId), isNull(deals.deletedAt), gte(deals.enteredAt, weekStart))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(proposals)
      .where(and(eq(proposals.organizationId, organizationId), gte(proposals.createdAt, since))),
    purchaseStageId
      ? db
          .select({ n: sql<number>`count(distinct ${auditLog.rowId})::int` })
          .from(auditLog)
          .where(
            and(
              eq(auditLog.organizationId, organizationId),
              eq(auditLog.tableName, "deals"),
              gte(auditLog.at, since),
              sql`'stage_id' = any(${auditLog.changedFields})`,
              sql`${auditLog.newData} ->> 'stage_id' = ${purchaseStageId}`,
            ),
          )
      : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(deals)
      .where(and(eq(deals.organizationId, organizationId), isNull(deals.deletedAt), gte(deals.deedDate, weekStart))),
  ]);
  return { newLeads: leads?.n ?? 0, proposals: props?.n ?? 0, purchases: Math.max(moved?.n ?? 0, deeded?.n ?? 0) };
}
