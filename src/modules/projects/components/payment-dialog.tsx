"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney } from "@/core/lib/format";
import { FormField, NativeSelect } from "@/core/ui/form-field";
import { addPayment, deletePayment } from "../invoices/actions";
import type { InvoiceRow } from "../invoices/queries";
import type { Payment } from "../schema";

const METHOD_LABEL: Record<Payment["method"], string> = { transferencia: "Transferência", mb: "Multibanco", cartao: "Cartão", numerario: "Numerário", outro: "Outro" };

type Props = { invoice: InvoiceRow | null; payments: Payment[]; onClose: () => void };

export function PaymentDialog({ invoice, payments, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!invoice) return null;
  const unpaid = Math.max(0, Number(invoice.total) - invoice.paidAmount);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await addPayment(invoice!.id, {
        paidOn: String(formData.get("paidOn") ?? ""),
        amount: Number(String(formData.get("amount") ?? "").replace(",", ".")),
        method: String(formData.get("method") ?? "transferencia") as Payment["method"],
        reference: String(formData.get("reference") ?? "") || null,
        notes: null,
      });
      if (!r.ok) return setError(r.error);
      router.refresh();
      onClose();
    });
  }
  function remove(id: string) {
    if (!confirm("Apagar este pagamento?")) return;
    startTransition(async () => {
      const r = await deletePayment(id);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagamentos · fatura {invoice.number}</DialogTitle>
          <DialogDescription>
            {invoice.supplierName} · total {formatMoney(invoice.total)} · pago {formatMoney(invoice.paidAmount)} · por pagar <b>{formatMoney(unpaid)}</b>
          </DialogDescription>
        </DialogHeader>

        {payments.length ? (
          <ul className="divide-y rounded-lg border text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-muted-foreground">{formatDate(p.paidOn)}</span>
                <span className="font-medium tabular-nums">{formatMoney(p.amount)}</span>
                <span className="text-xs text-muted-foreground">{METHOD_LABEL[p.method]}{p.reference ? ` · ${p.reference}` : ""}</span>
                <button type="button" onClick={() => remove(p.id)} className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive" title="Apagar"><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        ) : null}

        {unpaid > 0 ? (
          <form action={submit} className="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField id="pay-date" label="Data"><Input id="pay-date" name="paidOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></FormField>
            <FormField id="pay-amount" label="Valor (€)"><Input id="pay-amount" name="amount" inputMode="decimal" defaultValue={unpaid.toFixed(2)} required /></FormField>
            <FormField id="pay-method" label="Método">
              <NativeSelect id="pay-method" name="method" defaultValue="transferencia">
                {(Object.keys(METHOD_LABEL) as Payment["method"][]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="pay-ref" label="Referência (opcional)"><Input id="pay-ref" name="reference" placeholder="n.º transferência" /></FormField>
            {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Fechar</Button>
              <Button type="submit" disabled={pending}>{pending ? "…" : "Registar pagamento"}</Button>
            </DialogFooter>
          </form>
        ) : (
          <DialogFooter>
            <span className="mr-auto text-sm text-success">Fatura totalmente paga.</span>
            <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
