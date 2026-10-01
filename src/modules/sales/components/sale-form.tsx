"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection, NativeSelect } from "@/core/ui/form-field";
import type { SaleFormState } from "../actions";
import type { Sale } from "../schema";
import type { SaleInput } from "../validation";

type Option = { value: string; label: string };
type Props = {
  action: (prev: SaleFormState, formData: FormData) => Promise<SaleFormState>;
  sale: Sale;
  users: Option[];
  contacts: Option[];
  cancelHref: string;
};

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function SaleForm({ action, sale, users, contacts, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<SaleFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};
  const v = state.values as Partial<SaleInput> | undefined;
  const g = (key: keyof SaleInput, fromSale: string | number | null | undefined) => (v ? str(v[key]) : str(fromSale));

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormSection title="Anúncio" description="Preço e data a que o imóvel foi colocado no mercado.">
        <FormField id="listingPrice" label="Preço anunciado (€)" error={errors.listingPrice}>
          <Input id="listingPrice" name="listingPrice" inputMode="decimal" defaultValue={g("listingPrice", sale.listingPrice)} />
        </FormField>
        <FormField id="listingDate" label="Anunciado em" error={errors.listingDate}>
          <Input id="listingDate" name="listingDate" type="date" defaultValue={g("listingDate", sale.listingDate)} />
        </FormField>
        <FormField id="listingUrl" label="Link do anúncio" error={errors.listingUrl} className="md:col-span-2">
          <Input id="listingUrl" name="listingUrl" inputMode="url" placeholder="idealista.pt/…" defaultValue={g("listingUrl", sale.listingUrl)} />
        </FormField>
        <FormField id="ownerUserId" label="Responsável" error={errors.ownerUserId}>
          <NativeSelect id="ownerUserId" name="ownerUserId" defaultValue={g("ownerUserId", sale.ownerUserId)}>
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </FormSection>

      <FormSection title="Fecho" description="CPCV e escritura. Marcar a fase «Vendido» também pede o preço final e a data.">
        <FormField id="cpcvDate" label="Data do CPCV" error={errors.cpcvDate}>
          <Input id="cpcvDate" name="cpcvDate" type="date" defaultValue={g("cpcvDate", sale.cpcvDate)} />
        </FormField>
        <FormField id="cpcvDeposit" label="Sinal (€)" error={errors.cpcvDeposit}>
          <Input id="cpcvDeposit" name="cpcvDeposit" inputMode="decimal" defaultValue={g("cpcvDeposit", sale.cpcvDeposit)} />
        </FormField>
        <FormField id="deedDate" label="Data da escritura" error={errors.deedDate}>
          <Input id="deedDate" name="deedDate" type="date" defaultValue={g("deedDate", sale.deedDate)} />
        </FormField>
        <FormField id="salePrice" label="Preço final de venda (€)" error={errors.salePrice}>
          <Input id="salePrice" name="salePrice" inputMode="decimal" defaultValue={g("salePrice", sale.salePrice)} />
        </FormField>
        <FormField id="buyerContactId" label="Comprador" error={errors.buyerContactId} hint="Um lead marcado como «Ganho» preenche isto sozinho.">
          <NativeSelect id="buyerContactId" name="buyerContactId" defaultValue={g("buyerContactId", sale.buyerContactId)}>
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </FormSection>

      <FormSection title="Custos reais" description="Totais para o P&L. A comissão das mediadoras calcula-se a partir da aba Resumo.">
        <FormField id="otherSaleCosts" label="Outros custos de venda (€)" error={errors.otherSaleCosts} hint="Certificado energético, fotografias, CPCV, distrate.">
          <Input id="otherSaleCosts" name="otherSaleCosts" inputMode="decimal" defaultValue={g("otherSaleCosts", sale.otherSaleCosts)} />
        </FormField>
        <FormField id="actualHoldingCosts" label="Custos de detenção reais (€)" error={errors.actualHoldingCosts} hint="Condomínio, IMI, seguros, água, luz, até à venda.">
          <Input id="actualHoldingCosts" name="actualHoldingCosts" inputMode="decimal" defaultValue={g("actualHoldingCosts", sale.actualHoldingCosts)} />
        </FormField>
        <FormField id="actualFinancingCosts" label="Custos de financiamento reais (€)" error={errors.actualFinancingCosts} hint="Juros, comissões bancárias, penalização de reembolso.">
          <Input id="actualFinancingCosts" name="actualFinancingCosts" inputMode="decimal" defaultValue={g("actualFinancingCosts", sale.actualFinancingCosts)} />
        </FormField>
        <FormField id="notes" label="Notas" error={errors.notes} className="md:col-span-2">
          <Textarea id="notes" name="notes" rows={3} defaultValue={g("notes", sale.notes)} />
        </FormField>
      </FormSection>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button asChild type="button" variant="outline">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
