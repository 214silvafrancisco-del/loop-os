"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/core/ui/form-field";
import { todayIso } from "@/core/lib/dates";

type Props = {
  open: boolean;
  label: string;
  salePrice?: string | null;
  deedDate?: string | null;
  onCancel: () => void;
  onConfirm: (input: { salePrice: string; deedDate: string }) => Promise<string | null>;
};

/** Pedido ao marcar uma venda como Vendido: preço final e data da escritura. */
export function CloseSaleDialog({ open, label, salePrice, deedDate, onCancel, onConfirm }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const err = await onConfirm({ salePrice: String(formData.get("salePrice") ?? ""), deedDate: String(formData.get("deedDate") ?? "") });
      if (err) setError(err);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : null)}>
      <DialogContent>
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>Venda de {label}</DialogTitle>
            <DialogDescription>Regista o preço final e a escritura. O imóvel passa a Vendido e o negócio de origem sai do pipeline.</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <FormField id="cs-price" label="Preço final de venda (€)">
              <Input id="cs-price" name="salePrice" inputMode="decimal" defaultValue={salePrice ? String(Number(salePrice)) : ""} required autoFocus />
            </FormField>
            <FormField id="cs-deed" label="Data da escritura">
              <Input id="cs-deed" name="deedDate" type="date" defaultValue={deedDate ?? todayIso()} required />
            </FormField>
          </div>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar…" : "Confirmar venda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
