"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection, NativeSelect } from "@/core/ui/form-field";
import type { Contact } from "@/modules/contacts/schema";
import type { DealStage, SourceChannel, UserOption } from "@/modules/settings/queries";
import type { DealFormState } from "../actions";
import type { Deal } from "../schema";
import type { DealUpdateInput } from "../validation";

type Props = {
  action: (prev: DealFormState, formData: FormData) => Promise<DealFormState>;
  deal: Deal;
  stages: DealStage[];
  sources: SourceChannel[];
  users: UserOption[];
  contacts: Pick<Contact, "id" | "name" | "companyName" | "phone">[];
  cancelHref: string;
};

function str(v: string | number | null | undefined) {
  return v === null || v === undefined ? "" : String(v);
}

/** Fração "0.0500" → "5" para o campo de percentagem. */
function pctToInput(v: string | null) {
  return v ? String(Number(v) * 100) : "";
}

export function DealForm({ action, deal, stages, sources, users, contacts, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<DealFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};
  const v = state.values as Partial<DealUpdateInput> | undefined;
  const g = (key: keyof DealUpdateInput, fromDeal: string | number | null | undefined) =>
    v ? str(v[key]) : str(fromDeal);
  const purchaseStage = stages.find((s) => s.isPurchase);
  const isPurchase = (v?.stageId ?? deal.stageId) === purchaseStage?.id;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormSection title="Negócio">
        <FormField id="name" label="Nome" error={errors.name}>
          <Input id="name" name="name" defaultValue={g("name", deal.name)} />
        </FormField>
        <FormField id="stageId" label="Fase" error={errors.stageId}>
          <NativeSelect id="stageId" name="stageId" defaultValue={g("stageId", deal.stageId)}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="ownerUserId" label="Responsável" error={errors.ownerUserId}>
          <NativeSelect id="ownerUserId" name="ownerUserId" defaultValue={g("ownerUserId", deal.ownerUserId)}>
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="enteredAt" label="Data de entrada" error={errors.enteredAt}>
          <Input id="enteredAt" name="enteredAt" type="date" defaultValue={g("enteredAt", deal.enteredAt)} />
        </FormField>
      </FormSection>

      <FormSection title="Próxima ação">
        <FormField id="nextAction" label="O que fazer a seguir" error={errors.nextAction}>
          <Input id="nextAction" name="nextAction" defaultValue={g("nextAction", deal.nextAction)} />
        </FormField>
        <FormField id="nextActionDate" label="Quando" error={errors.nextActionDate}>
          <Input id="nextActionDate" name="nextActionDate" type="date" defaultValue={g("nextActionDate", deal.nextActionDate)} />
        </FormField>
      </FormSection>

      <FormSection title="Origem">
        <FormField id="sourceChannelId" label="Fonte" error={errors.sourceChannelId}>
          <NativeSelect id="sourceChannelId" name="sourceChannelId" defaultValue={g("sourceChannelId", deal.sourceChannelId)}>
            <option value="">—</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="sourceContactId" label="Contacto" error={errors.sourceContactId}>
          <NativeSelect id="sourceContactId" name="sourceContactId" defaultValue={g("sourceContactId", deal.sourceContactId)}>
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.companyName ? ` · ${c.companyName}` : ""}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="listingUrl" label="Link do anúncio" error={errors.listingUrl}>
          <Input id="listingUrl" name="listingUrl" inputMode="url" defaultValue={g("listingUrl", deal.listingUrl)} />
        </FormField>
        <FormField id="sourceCommissionPct" label="Comissão (%)" error={errors.sourceCommissionPct}>
          <Input id="sourceCommissionPct" name="sourceCommissionPct" inputMode="decimal" defaultValue={v ? str(v.sourceCommissionPct) : pctToInput(deal.sourceCommissionPct)} />
        </FormField>
        <FormField id="sourceNotes" label="Observações" error={errors.sourceNotes} className="md:col-span-2">
          <Textarea id="sourceNotes" name="sourceNotes" rows={2} defaultValue={g("sourceNotes", deal.sourceNotes)} />
        </FormField>
      </FormSection>

      <FormSection title="Financeiro inicial" description="Estimativas rápidas. A análise completa fica no Business Plan.">
        <FormField id="askingPrice" label="Preço pedido (€)" error={errors.askingPrice}>
          <Input id="askingPrice" name="askingPrice" inputMode="decimal" defaultValue={g("askingPrice", deal.askingPrice)} />
        </FormField>
        <FormField id="targetPrice" label="Preço alvo (€)" error={errors.targetPrice}>
          <Input id="targetPrice" name="targetPrice" inputMode="decimal" defaultValue={g("targetPrice", deal.targetPrice)} />
        </FormField>
        <FormField id="maxPrice" label="Preço máximo (€)" error={errors.maxPrice}>
          <Input id="maxPrice" name="maxPrice" inputMode="decimal" defaultValue={g("maxPrice", deal.maxPrice)} />
        </FormField>
        <FormField id="estimatedWorks" label="Obra estimada (€)" error={errors.estimatedWorks}>
          <Input id="estimatedWorks" name="estimatedWorks" inputMode="decimal" defaultValue={g("estimatedWorks", deal.estimatedWorks)} />
        </FormField>
        <FormField id="estimatedSalePrice" label="Venda estimada (€)" error={errors.estimatedSalePrice}>
          <Input id="estimatedSalePrice" name="estimatedSalePrice" inputMode="decimal" defaultValue={g("estimatedSalePrice", deal.estimatedSalePrice)} />
        </FormField>
      </FormSection>

      <FormSection
        title="Compra"
        description={isPurchase ? "Dados reais da aquisição." : "Preenche quando o negócio passar a Compra."}
      >
        <FormField id="finalPrice" label="Valor final de compra (€)" error={errors.finalPrice}>
          <Input id="finalPrice" name="finalPrice" inputMode="decimal" defaultValue={g("finalPrice", deal.finalPrice)} />
        </FormField>
        <FormField id="actualAcquisitionCosts" label="Custos reais de aquisição (€)" error={errors.actualAcquisitionCosts} hint="IS, escritura, registos, comissão.">
          <Input id="actualAcquisitionCosts" name="actualAcquisitionCosts" inputMode="decimal" defaultValue={g("actualAcquisitionCosts", deal.actualAcquisitionCosts)} />
        </FormField>
        <FormField id="cpcvDate" label="Data do CPCV" error={errors.cpcvDate}>
          <Input id="cpcvDate" name="cpcvDate" type="date" defaultValue={g("cpcvDate", deal.cpcvDate)} />
        </FormField>
        <FormField id="deedDate" label="Data da escritura" error={errors.deedDate} hint="Define o prazo de 3 anos da isenção de IMT.">
          <Input id="deedDate" name="deedDate" type="date" defaultValue={g("deedDate", deal.deedDate)} />
        </FormField>
      </FormSection>

      {state.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
