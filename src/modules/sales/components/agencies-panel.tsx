"use client";

import { Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPercent } from "@/core/lib/format";
import { FormField, NativeSelect } from "@/core/ui/form-field";
import { removeAgency, saveAgency, type AgencyFormState } from "../actions";
import { commissionAmount } from "../constants";
import type { SaleAgencyRow } from "../queries";

type Option = { value: string; label: string };
type Props = { saleId: string; agencies: SaleAgencyRow[]; contacts: Option[]; referencePrice: string | null };

const pctToInput = (v: string | null) => (v ? String(Math.round(Number(v) * 10000) / 100) : "");

function AgencyDialog({ saleId, agency, contacts, onClose }: { saleId: string; agency: SaleAgencyRow | null; contacts: Option[]; onClose: () => void }) {
  const router = useRouter();
  const action = saveAgency.bind(null, saleId, agency?.id ?? null);
  const [state, formAction, pending] = useActionState<AgencyFormState, FormData>(
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
  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{agency ? "Editar mediadora" : "Adicionar mediadora"}</DialogTitle>
            <DialogDescription>Podem estar várias a vender em simultâneo, cada uma com a sua comissão. A mediadora é um contacto.</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <FormField id="ag-contact" label="Mediadora (contacto)" error={errors.contactId} className="sm:col-span-2">
              <NativeSelect id="ag-contact" name="contactId" defaultValue={v?.contactId ?? agency?.contactId ?? ""} required disabled={Boolean(agency)}>
                <option value="">Escolher…</option>
                {contacts.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
              {agency ? <input type="hidden" name="contactId" value={agency.contactId} /> : null}
            </FormField>
            <FormField id="ag-pct" label="Comissão (%)" error={errors.commissionPct} hint="Sobre o preço de venda, sem IVA.">
              <Input id="ag-pct" name="commissionPct" inputMode="decimal" defaultValue={v?.commissionPct ?? pctToInput(agency?.commissionPct ?? null)} placeholder="5" />
            </FormField>
            <FormField id="ag-fixed" label="Ou valor fixo (€)" error={errors.commissionFixed} hint="Se preenchido, ignora a percentagem.">
              <Input id="ag-fixed" name="commissionFixed" inputMode="decimal" defaultValue={v?.commissionFixed ?? (agency?.commissionFixed ? String(Number(agency.commissionFixed)) : "")} />
            </FormField>
            <FormField id="ag-vat" label="IVA da comissão (%)" error={errors.commissionVatPct}>
              <Input id="ag-vat" name="commissionVatPct" inputMode="decimal" defaultValue={v?.commissionVatPct ?? pctToInput(agency?.commissionVatPct ?? "0.2300")} />
            </FormField>
            <FormField id="ag-start" label="Início" error={errors.startDate}>
              <Input id="ag-start" name="startDate" type="date" defaultValue={v?.startDate ?? agency?.startDate ?? ""} />
            </FormField>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="exclusive" defaultChecked={v ? v.exclusive === "on" : (agency?.exclusive ?? false)} className="size-4 accent-primary" />
              Contrato em exclusivo
            </label>
            <FormField id="ag-notes" label="Notas" error={errors.notes} className="sm:col-span-2">
              <Textarea id="ag-notes" name="notes" rows={2} defaultValue={v?.notes ?? agency?.notes ?? ""} />
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

/** Mediadoras da venda com a comissão estimada sobre o preço (venda ou anúncio). */
export function AgenciesPanel({ saleId, agencies, contacts, referencePrice }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<SaleAgencyRow | null | "new">(null);
  const [, startTransition] = useTransition();
  const price = referencePrice ? Number(referencePrice) : null;

  function remove(a: SaleAgencyRow) {
    if (!confirm(`Remover ${a.contactName} desta venda?`)) return;
    startTransition(async () => {
      const r = await removeAgency(saleId, a.id);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border bg-card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Mediadoras</h2>
          <p className="text-xs text-muted-foreground">Quem está a vender e com que comissão{price ? ` (estimada sobre ${formatCurrency(price)})` : ""}.</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-10 gap-1 md:h-8" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
      {agencies.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Sem mediadoras. Venda direta ou ainda por definir.</p>
      ) : (
        <ul className="divide-y">
          {agencies.map((a) => {
            const c = commissionAmount(price, { commissionPct: a.commissionPct ? Number(a.commissionPct) : null, commissionFixed: a.commissionFixed ? Number(a.commissionFixed) : null, commissionVatPct: Number(a.commissionVatPct) });
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {a.contactName}
                    {a.contactCompany ? <span className="font-normal text-muted-foreground"> · {a.contactCompany}</span> : null}
                    {a.exclusive ? <span className="ml-2 rounded-full bg-primary/10 px-1.5 text-[11px] font-medium text-primary">exclusivo</span> : null}
                  </p>
                  <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {a.contactPhone ? (
                      <a href={`tel:${a.contactPhone}`} className="inline-flex items-center gap-1 hover:underline">
                        <Phone className="size-3" /> {a.contactPhone}
                      </a>
                    ) : null}
                    <span>{a.commissionFixed ? `${formatCurrency(a.commissionFixed)} fixo` : a.commissionPct ? `${formatPercent(a.commissionPct)} de comissão` : "comissão por definir"}</span>
                    <span>
                      {a.leadsCount} {a.leadsCount === 1 ? "lead" : "leads"}
                    </span>
                  </p>
                </div>
                <div className="text-right text-xs tabular-nums">
                  <p className="font-medium">{c.total ? formatCurrency(c.total) : "—"}</p>
                  {c.total ? <p className="text-muted-foreground">{formatCurrency(c.net)} + IVA</p> : null}
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" className="size-10 md:size-8" aria-label="Editar" onClick={() => setEditing(a)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-10 text-muted-foreground hover:text-destructive md:size-8" aria-label="Remover" onClick={() => remove(a)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing ? <AgencyDialog saleId={saleId} agency={editing === "new" ? null : editing} contacts={contacts} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
