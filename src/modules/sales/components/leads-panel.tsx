"use client";

import { Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { FormField, NativeSelect } from "@/core/ui/form-field";
import { removeLead, saveLead, setLeadStatus, type LeadFormState } from "../actions";
import { LEAD_SOURCES, LEAD_SOURCE_LABEL, LEAD_STATUSES } from "../constants";
import type { SaleLeadRow } from "../queries";
import type { LeadStatus } from "../schema";
import { LeadStatusBadge } from "./sale-badges";
import { LeadNextAction } from "./sale-next-action";

type Option = { value: string; label: string };
type Props = { saleId: string; leads: SaleLeadRow[]; agencies: Option[]; contacts: Option[] };

function LeadDialog({ saleId, lead, agencies, contacts, onClose }: { saleId: string; lead: SaleLeadRow | null; agencies: Option[]; contacts: Option[]; onClose: () => void }) {
  const router = useRouter();
  const action = saveLead.bind(null, saleId, lead?.id ?? null);
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(
    async (prev, fd) => {
      const r = await action(prev, fd);
      if (!r.error) {
        router.refresh();
        onClose();
      }
      return r;
    },
    {},
  );
  const errors = state.fieldErrors ?? {};
  const v = state.values;
  const d = (key: keyof NonNullable<typeof v>, fallback: string | null | undefined) => (v ? String(v[key] ?? "") : (fallback ?? ""));
  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{lead ? "Editar lead" : "Novo lead"}</DialogTitle>
            <DialogDescription>Interessado no imóvel. Marca «Ganho» quando fechar: passa a comprador na venda.</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <FormField id="ld-name" label="Nome" error={errors.name}>
              <Input id="ld-name" name="name" defaultValue={d("name", lead?.name)} required autoFocus />
            </FormField>
            <FormField id="ld-phone" label="Telefone" error={errors.phone}>
              <Input id="ld-phone" name="phone" inputMode="tel" defaultValue={d("phone", lead?.phone)} />
            </FormField>
            <FormField id="ld-email" label="Email" error={errors.email}>
              <Input id="ld-email" name="email" inputMode="email" defaultValue={d("email", lead?.email)} />
            </FormField>
            <FormField id="ld-contact" label="Contacto existente" error={errors.contactId} hint="Opcional; usado como comprador se ganhar.">
              <NativeSelect id="ld-contact" name="contactId" defaultValue={d("contactId", lead?.contactId)}>
                <option value="">—</option>
                {contacts.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="ld-source" label="Origem" error={errors.source}>
              <NativeSelect id="ld-source" name="source" defaultValue={d("source", lead?.source ?? "portal")}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="ld-agency" label="Mediadora" error={errors.agencyId}>
              <NativeSelect id="ld-agency" name="agencyId" defaultValue={d("agencyId", lead?.agencyId)}>
                <option value="">—</option>
                {agencies.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="ld-status" label="Estado" error={errors.status}>
              <NativeSelect id="ld-status" name="status" defaultValue={d("status", lead?.status ?? "novo")}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="ld-visit" label="Data da visita" error={errors.visitDate}>
              <Input id="ld-visit" name="visitDate" type="date" defaultValue={d("visitDate", lead?.visitDate)} />
            </FormField>
            <FormField id="ld-offer" label="Valor proposto (€)" error={errors.offerAmount}>
              <Input id="ld-offer" name="offerAmount" inputMode="decimal" defaultValue={d("offerAmount", lead?.offerAmount ? String(Number(lead.offerAmount)) : "")} />
            </FormField>
            <FormField id="ld-next" label="Próxima ação" error={errors.nextAction}>
              <Input id="ld-next" name="nextAction" defaultValue={d("nextAction", lead?.nextAction)} placeholder="Ligar, marcar visita…" />
            </FormField>
            <FormField id="ld-next-date" label="Data da próxima ação" error={errors.nextActionDate}>
              <Input id="ld-next-date" name="nextActionDate" type="date" defaultValue={d("nextActionDate", lead?.nextActionDate)} />
            </FormField>
            <FormField id="ld-notes" label="Notas" error={errors.notes} className="sm:col-span-2">
              <Textarea id="ld-notes" name="notes" rows={2} defaultValue={d("notes", lead?.notes)} />
            </FormField>
          </div>
          {state.error ? <p className="mb-3 text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Registo de leads da venda: cartões com estado, origem, visita, proposta e próxima ação. */
export function LeadsPanel({ saleId, leads, agencies, contacts }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<SaleLeadRow | null | "new">(null);
  const [, startTransition] = useTransition();
  const open = leads.filter((l) => l.status !== "ganho" && l.status !== "perdido");
  const closed = leads.filter((l) => l.status === "ganho" || l.status === "perdido");

  function changeStatus(l: SaleLeadRow, status: LeadStatus) {
    startTransition(async () => {
      const r = await setLeadStatus(saleId, l.id, status);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }
  function remove(l: SaleLeadRow) {
    if (!confirm(`Apagar o lead ${l.name}?`)) return;
    startTransition(async () => {
      await removeLead(saleId, l.id);
      router.refresh();
    });
  }

  const card = (l: SaleLeadRow) => (
    <li key={l.id} className={cn("flex flex-col gap-2 rounded-xl border bg-card p-3", (l.status === "perdido") && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {l.name}
            <LeadStatusBadge status={l.status} />
          </p>
          <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {l.phone ? (
              <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:underline">
                <Phone className="size-3" /> {l.phone}
              </a>
            ) : null}
            {l.email ? (
              <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:underline">
                <Mail className="size-3" /> {l.email}
              </a>
            ) : null}
            <span>{l.agencyName ? `via ${l.agencyName}` : LEAD_SOURCE_LABEL[l.source]}</span>
            {l.visitDate ? <span>visita {formatDate(l.visitDate)}</span> : null}
            {l.offerAmount ? <span className="font-medium text-foreground">proposta {formatCurrency(l.offerAmount)}</span> : null}
          </p>
          {l.notes ? <p className="mt-1 text-xs text-muted-foreground">{l.notes}</p> : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-10 md:size-8" aria-label="Editar" onClick={() => setEditing(l)}>
            <Pencil className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-10 text-muted-foreground hover:text-destructive md:size-8" aria-label="Apagar" onClick={() => remove(l)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Estado do lead" value={l.status} onChange={(e) => changeStatus(l, e.target.value as LeadStatus)} className="h-10 w-auto text-sm md:h-8">
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
        <div className="min-w-0 flex-1 rounded-md border">
          <LeadNextAction saleId={saleId} leadId={l.id} action={l.nextAction} date={l.nextActionDate} compact />
        </div>
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {open.length} em aberto · {closed.length} fechados
        </p>
        <Button type="button" size="sm" className="h-10 gap-1 md:h-8" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Novo lead
        </Button>
      </div>
      {leads.length === 0 ? <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Sem leads. Regista cada interessado com a origem (mediadora, portal, direto) e a próxima ação.</p> : null}
      {open.length ? <ul className="flex flex-col gap-2">{open.map(card)}</ul> : null}
      {closed.length ? (
        <details className="rounded-xl border bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Fechados ({closed.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">{closed.map(card)}</ul>
        </details>
      ) : null}
      {editing ? <LeadDialog saleId={saleId} lead={editing === "new" ? null : editing} agencies={agencies} contacts={contacts} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
