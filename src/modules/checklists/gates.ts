import "server-only";
import type { GateMissing } from "./gate-rules";
import { getGateCheck } from "./queries";
import type { ChecklistEntityType } from "./schema";
import { syncChecklist } from "./sync";

export type GateResult = { hard: GateMissing[]; warn: GateMissing[] };

/**
 * Sincroniza a checklist com os dados atuais e devolve o que falta para uma
 * porta. Sem checklist (entidade sem template) não bloqueia nada.
 */
export async function checkGate(organizationId: string, entityType: ChecklistEntityType, entityId: string, gate: string, userId: string | null): Promise<GateResult> {
  await syncChecklist(organizationId, entityType, entityId, userId);
  const c = await getGateCheck(organizationId, entityType, entityId, gate);
  const pick = (items: typeof c.hard): GateMissing[] => items.map((i) => ({ label: i.label, linkPath: i.linkPath, isRequired: i.isRequired }));
  return { hard: pick(c.hard), warn: pick(c.warn) };
}
