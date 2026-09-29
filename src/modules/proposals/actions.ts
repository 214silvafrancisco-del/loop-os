"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/core/auth/current-user";
import { db } from "@/core/db/client";
import { fieldErrorsOf, optionalInt, optionalText } from "@/core/lib/form-schemas";
import { dealStages } from "@/modules/settings/schema";
import { deals } from "@/modules/deals/schema";
import { proposals } from "./schema";
import { generateProposal } from "./service";

export type ProposalFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  createdId?: string;
};

const schema = z.object({
  templateId: z.uuid("Escolhe o template."),
  offerPrice: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({ code: "custom", message: "Indica o valor da proposta." });
        return z.NEVER;
      }
      return n;
    }),
  deadlineDays: optionalInt,
  validityDays: optionalInt,
  conditions: optionalText,
  observations: optionalText,
});

/** Gera o PDF e o texto WhatsApp. Nunca envia nada. */
export async function createProposal(dealId: string, _prev: ProposalFormState, formData: FormData): Promise<ProposalFormState> {
  const user = await requireUser();
  const values = Object.fromEntries(["templateId", "offerPrice", "deadlineDays", "validityDays", "conditions", "observations"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: "Corrige os campos assinalados.", fieldErrors: fieldErrorsOf(parsed.error.issues), values };

  try {
    const created = await generateProposal(user, dealId, {
      templateId: parsed.data.templateId,
      offerPrice: parsed.data.offerPrice,
      deadlineDays: parsed.data.deadlineDays ?? null,
      validityDays: parsed.data.validityDays ?? null,
      conditions: parsed.data.conditions?.replace(/\r\n?/g, "\n") ?? null,
      observations: parsed.data.observations?.replace(/\r\n?/g, "\n") ?? null,
    });

    // Um negócio com proposta gerada avança para a fase "Proposta" se ainda estiver atrás.
    await advanceToProposalStage(user.organizationId, dealId, user.id);

    revalidatePath(`/deals/${dealId}`, "layout");
    revalidatePath("/deals");
    return { createdId: created.id };
  } catch (e) {
    console.error("[proposals/create]", e);
    return { error: e instanceof Error ? e.message : "Não foi possível gerar a proposta.", values };
  }
}

async function advanceToProposalStage(organizationId: string, dealId: string, userId: string) {
  const stages = await db
    .select({ id: dealStages.id, name: dealStages.name, sort: dealStages.sort, isPurchase: dealStages.isPurchase })
    .from(dealStages)
    .where(and(eq(dealStages.organizationId, organizationId), eq(dealStages.isActive, true)));
  const proposalStage = stages.find((s) => s.name.toLowerCase().startsWith("proposta"));
  if (!proposalStage) return;
  const [deal] = await db.select({ stageId: deals.stageId }).from(deals).where(eq(deals.id, dealId));
  const current = stages.find((s) => s.id === deal?.stageId);
  if (!current || current.isPurchase || current.sort >= proposalStage.sort) return;
  await db.update(deals).set({ stageId: proposalStage.id, updatedBy: userId }).where(eq(deals.id, dealId));
}

const STATUSES = ["generated", "sent", "accepted", "rejected"] as const;

/** Estado marcado à mão pelo utilizador (enviada, aceite, recusada). */
export async function setProposalStatus(proposalId: string, status: (typeof STATUSES)[number]): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!STATUSES.includes(status)) return { ok: false, error: "Estado inválido." };
  const now = new Date();
  const [row] = await db
    .update(proposals)
    .set({
      status,
      sentAt: status === "sent" ? now : undefined,
      decidedAt: status === "accepted" || status === "rejected" ? now : status === "generated" ? null : undefined,
      updatedBy: user.id,
    })
    .where(and(eq(proposals.id, proposalId), eq(proposals.organizationId, user.organizationId)))
    .returning({ dealId: proposals.dealId });
  if (!row) return { ok: false, error: "Proposta não encontrada." };
  revalidatePath(`/deals/${row.dealId}`, "layout");
  return { ok: true };
}
