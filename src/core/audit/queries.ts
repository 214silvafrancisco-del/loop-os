import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { auditLog, type AuditEntry } from "@/core/db/schema/audit";
import { profiles } from "@/core/db/schema/core";

export type AuditRow = AuditEntry & { userName: string | null };

/** Histórico de tudo o que aconteceu a um imóvel (negócios, notas, obra…). */
export async function listAuditForProperty(organizationId: string, propertyId: string, limit = 200): Promise<AuditRow[]> {
  return db
    .select({
      id: auditLog.id,
      organizationId: auditLog.organizationId,
      tableName: auditLog.tableName,
      rowId: auditLog.rowId,
      propertyId: auditLog.propertyId,
      action: auditLog.action,
      changedFields: auditLog.changedFields,
      oldData: auditLog.oldData,
      newData: auditLog.newData,
      userId: auditLog.userId,
      at: auditLog.at,
      userName: profiles.fullName,
    })
    .from(auditLog)
    .leftJoin(profiles, eq(auditLog.userId, profiles.id))
    .where(and(eq(auditLog.organizationId, organizationId), eq(auditLog.propertyId, propertyId)))
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(limit);
}
