"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/core/ui/form-field";
import type { PurchaseInput } from "../actions";
import { todayIso } from "../utils";

type Props = {
  open: boolean;
  dealLabel: string;
  askingPrice?: string | null;
  onCancel: () => void;
  onConfirm: (input: PurchaseInput) => Promise<string | null>;
};

/** Pedido ao passar um negócio para Compra: valor final e datas. */
export function PurchaseDialog({ open, dealLabel, askingPrice, onCancel, onConfirm }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const err = await onConfirm({
        finalPrice: String(formData.get("finalPrice") ?? ""),
        cpcvDate: String(formData.get("cpcvDate") ?? ""),
        deedDate: String(formData.get("deedDate") ?? ""),
        actualAcquisitionCosts: String(formData.get("actualAcquisitionCosts") ?? ""),
      });
      if (err) setError(err);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : null)}>
      <DialogContent>
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>Compra de {dealLabel}</DialogTitle>
            <DialogDescription>
              Regista o valor final e a escritura. O imóvel passa a Comprado e fica disponível para criar obra.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <FormField id="pd-finalPrice" label="Valor final de compra (€)">
              <Input id="pd-finalPrice" name="finalPrice" inputMode="decimal" defaultValue={askingPrice ? String(Number(askingPrice)) : ""} required autoFocus />
            </FormField>
            <FormField id="pd-costs" label="Custos de aquisição (€)" hint="IS, escritura, registos, comissão.">
              <Input id="pd-costs" name="actualAcquisitionCosts" inputMode="decimal" />
            </FormField>
            <FormField id="pd-cpcv" label="Data do CPCV">
              <Input id="pd-cpcv" name="cpcvDate" type="date" />
            </FormField>
            <FormField id="pd-deed" label="Data da escritura">
              <Input id="pd-deed" name="deedDate" type="date" defaultValue={todayIso()} required />
            </FormField>
          </div>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar…" : "Confirmar compra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
