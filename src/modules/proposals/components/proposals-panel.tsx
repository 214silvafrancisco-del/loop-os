"use client";

import { Copy, FileText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { FormField, FormSection, NativeSelect } from "@/core/ui/form-field";
import { GateNotice } from "@/modules/checklists/components/gate-notice";
import type { GateMissing } from "@/modules/checklists/gate-rules";
import { createProposal, setProposalStatus, type ProposalFormState } from "../actions";
import type { ProposalRow } from "../queries";
import type { ProposalTemplate } from "../schema";

type Suggestion = { label: string; value: number };

type Props = {
  dealId: string;
  templates: ProposalTemplate[];
  proposals: ProposalRow[];
  suggestions: Suggestion[];
  defaultConditions: string;
  /** Porta "gerar proposta": `hard` bloqueia o formulário. */
  gate?: { hard: GateMissing[]; warn: GateMissing[] };
};

const STATUS_LABEL: Record<ProposalRow["status"], string> = {
  draft: "Rascunho",
  generated: "Gerada",
  sent: "Enviada",
  accepted: "Aceite",
  rejected: "Recusada",
};
const STATUS_CLASS: Record<ProposalRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  generated: "bg-muted text-foreground",
  sent: "bg-warning/20 text-foreground",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

export function ProposalsPanel({ dealId, templates, proposals, suggestions, defaultConditions, gate }: Props) {
  const blocked = (gate?.hard.length ?? 0) > 0;
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ProposalFormState, FormData>(createProposal.bind(null, dealId), {});
  const [price, setPrice] = useState<string>(state.values?.offerPrice ?? "");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [copied, setCopied] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};
  const template = templates.find((t) => t.id === templateId);
  const defaults = template?.pdfDefaults ?? {};

  async function copyText(p: ProposalRow) {
    if (!p.whatsappText) return;
    try {
      await navigator.clipboard.writeText(p.whatsappText);
      setCopied(p.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert(p.whatsappText);
    }
  }

  function changeStatus(p: ProposalRow, status: "generated" | "sent" | "accepted" | "rejected") {
    startTransition(async () => {
      const r = await setProposalStatus(p.id, status);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {state.createdId ? (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm">
          Proposta gerada. O PDF ficou nos Documentos (Jurídico → Proposta). Revê e envia por WhatsApp ou email; a app nunca envia.
        </p>
      ) : null}

      {gate ? <GateNotice hard={gate.hard} warn={gate.warn} basePath={`/deals/${dealId}`} action="gerar a proposta" /> : null}

      <form action={formAction} className={cn("flex flex-col gap-5", blocked && "pointer-events-none opacity-50")}>
        <FormSection title="Nova proposta" description="Gera o PDF e o texto para WhatsApp. Nunca envia nada automaticamente.">
          <FormField id="templateId" label="Template" error={errors.templateId}>
            <NativeSelect id="templateId" name="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="offerPrice" label="Valor da proposta (€)" error={errors.offerPrice}>
            <Input id="offerPrice" name="offerPrice" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </FormField>
          {suggestions.length ? (
            <div className="flex flex-wrap items-center gap-1.5 md:col-span-2">
              <Sparkles className="size-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Sugestões:</span>
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setPrice(String(Math.round(s.value)))}
                  className={cn("rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent", String(Math.round(s.value)) === price && "border-primary bg-primary/10")}
                >
                  {s.label}: <span className="font-medium tabular-nums">{formatCurrency(s.value)}</span>
                </button>
              ))}
            </div>
          ) : null}
          <FormField id="deadlineDays" label="Prazo para escritura (dias)" error={errors.deadlineDays}>
            <Input id="deadlineDays" name="deadlineDays" inputMode="numeric" defaultValue={state.values?.deadlineDays ?? String(defaults.deadlineDays ?? 60)} />
          </FormField>
          <FormField id="validityDays" label="Validade da proposta (dias)" error={errors.validityDays}>
            <Input id="validityDays" name="validityDays" inputMode="numeric" defaultValue={state.values?.validityDays ?? String(defaults.validityDays ?? 7)} />
          </FormField>
          <FormField id="conditions" label="Condições" error={errors.conditions} className="md:col-span-2" hint="Uma condição por linha.">
            <Textarea id="conditions" name="conditions" rows={4} defaultValue={state.values?.conditions ?? defaults.conditions ?? defaultConditions} />
          </FormField>
          <FormField id="observations" label="Observações" error={errors.observations} className="md:col-span-2">
            <Textarea id="observations" name="observations" rows={2} defaultValue={state.values?.observations ?? ""} />
          </FormField>
        </FormSection>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || blocked} className="gap-1">
            <FileText className="size-4" />
            {pending ? "A gerar PDF…" : proposals.length ? "Gerar nova versão" : "Gerar proposta PDF"}
          </Button>
        </div>
      </form>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Propostas geradas</h3>
        {proposals.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Ainda nenhuma.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {proposals.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {p.number}{p.versionNo > 1 ? ` · v${p.versionNo}` : ""}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{formatCurrency(p.offerPrice)}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[p.status])}>{STATUS_LABEL[p.status]}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(p.generatedAt)} · {p.authorName ?? "—"}
                    {p.deadlineDays ? ` · escritura ${p.deadlineDays} d` : ""}
                    {p.validityDays ? ` · válida ${p.validityDays} d` : ""}
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    {p.versionId ? (
                      <Button asChild size="sm" variant="outline" className="gap-1">
                        <a href={`/api/documents/${p.versionId}/download?inline=1`} target="_blank" rel="noreferrer">
                          <FileText className="size-4" /> PDF
                        </a>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => copyText(p)} disabled={!p.whatsappText}>
                      <Copy className="size-4" /> {copied === p.id ? "Copiado!" : "Copiar para WhatsApp"}
                    </Button>
                    <NativeSelect value={p.status === "draft" ? "generated" : p.status} onChange={(e) => changeStatus(p, e.target.value as "generated" | "sent" | "accepted" | "rejected")} className="h-8 w-auto text-xs">
                      <option value="generated">Gerada</option>
                      <option value="sent">Enviada</option>
                      <option value="accepted">Aceite</option>
                      <option value="rejected">Recusada</option>
                    </NativeSelect>
                  </span>
                </div>
                {p.whatsappText ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">Ver texto para WhatsApp</summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-foreground">{p.whatsappText}</pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
