"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/core/ui/form-field";
import { updateSaleRealCosts } from "../actions";

type Props = {
  saleId: string;
  hasDeal: boolean;
  values: { acquisitionCosts: number | null; holdingCosts: number | null; financingCosts: number | null; otherSaleCosts: number; durationMonths: number | null };
  computedMonths: number | null;
};

const str = (v: number | null) => (v === null ? "" : String(v));

/** Valores reais que não vêm de outro módulo: introduzem-se aqui, na tab Resultado. */
export function RealCostsForm({ saleId, hasDeal, values, computedMonths }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function submit(fd: FormData) {
    setMsg(null);
    startTransition(async () => {
      const r = await updateSaleRealCosts(saleId, {
        acquisitionCosts: String(fd.get("acquisitionCosts") ?? ""),
        holdingCosts: String(fd.get("holdingCosts") ?? ""),
        financingCosts: String(fd.get("financingCosts") ?? ""),
        otherSaleCosts: String(fd.get("otherSaleCosts") ?? ""),
        durationMonths: String(fd.get("durationMonths") ?? ""),
      });
      setMsg(r.ok ? "Guardado. O resultado foi recalculado." : r.error);
      if (r.ok) router.refresh();
    });
  }

  return (
    <form action={submit} className="rounded-xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-semibold">Valores introduzidos aqui</h2>
      <p className="mb-4 text-xs text-muted-foreground">O resto vem dos outros módulos: compra do negócio, obra das faturas, venda e comissões da venda.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="rc-acq" label="Custos de aquisição (€)" hint={hasDeal ? "IS, escritura, registos, comissão de compra. Fica guardado no negócio." : "Sem negócio ligado: não aplicável."}>
          <Input id="rc-acq" name="acquisitionCosts" inputMode="decimal" defaultValue={str(values.acquisitionCosts)} disabled={!hasDeal} />
        </FormField>
        <FormField id="rc-hold" label="Custos de detenção (€)" hint="Condomínio, IMI, seguros, água, luz, até à venda.">
          <Input id="rc-hold" name="holdingCosts" inputMode="decimal" defaultValue={str(values.holdingCosts)} />
        </FormField>
        <FormField id="rc-fin" label="Custos de financiamento (€)" hint="Juros, comissões bancárias, penalização de reembolso.">
          <Input id="rc-fin" name="financingCosts" inputMode="decimal" defaultValue={str(values.financingCosts)} />
        </FormField>
        <FormField id="rc-other" label="Outros custos de venda (€)" hint="Certificado energético, fotografias, CPCV, distrate. As comissões das mediadoras somam-se sozinhas.">
          <Input id="rc-other" name="otherSaleCosts" inputMode="decimal" defaultValue={str(values.otherSaleCosts)} />
        </FormField>
        <FormField id="rc-months" label="Duração (meses)" hint={computedMonths !== null ? `Para o retorno anualizado. Vazio = calculada pelas escrituras (${computedMonths} meses).` : "Para o retorno anualizado. Sem escritura de compra registada, é preciso indicar aqui."}>
          <Input id="rc-months" name="durationMonths" inputMode="decimal" placeholder={computedMonths !== null ? String(computedMonths) : "ex.: 6"} defaultValue={str(values.durationMonths)} />
        </FormField>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
        <Button type="submit" disabled={pending} className="h-11 gap-1 md:h-9">
          <Check className="size-4" /> {pending ? "A guardar…" : "Guardar e recalcular"}
        </Button>
      </div>
    </form>
  );
}
