"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/core/lib/format";
import { FormField, NativeSelect } from "@/core/ui/form-field";
import { attachInvoiceDocument, createInvoice, updateInvoice, type InvoiceInput } from "../invoices/actions";
import type { InvoiceRow } from "../invoices/queries";

type Option = { id: string; name: string };
type MeasurementOption = { id: string; number: number; label: string; total: number };

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  propertyId: string;
  suppliers: Option[];
  measurements: MeasurementOption[];
  invoice?: InvoiceRow | null;
  invoiceCategoryId: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function InvoiceDialog({ open, onClose, projectId, propertyId, suppliers, measurements, invoice, invoiceCategoryId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [net, setNet] = useState(invoice ? Number(invoice.netAmount) : 0);
  const [vatRate, setVatRate] = useState(invoice ? Number(invoice.vatRate) : 0.23);
  const [measurementId, setMeasurementId] = useState(invoice?.measurementReportId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const vat = r2(net * vatRate);
  const total = r2(net + vat);
  const measurement = measurements.find((m) => m.id === measurementId);

  // O estado inicial vem das props; o pai remonta o diálogo (key) a cada abertura.

  function submit(formData: FormData) {
    setError(null);
    const input: InvoiceInput = {
      supplierId: String(formData.get("supplierId") ?? ""),
      number: String(formData.get("number") ?? ""),
      issueDate: String(formData.get("issueDate") ?? ""),
      dueDate: String(formData.get("dueDate") ?? "") || null,
      description: String(formData.get("description") ?? "") || null,
      netAmount: net,
      vatRate,
      vatAmount: vat,
      total,
      measurementReportId: measurementId || null,
      notes: String(formData.get("notes") ?? "") || null,
    };
    startTransition(async () => {
      let invoiceId = invoice?.id;
      if (invoice) {
        const r = await updateInvoice(invoice.id, input);
        if (!r.ok) return setError(r.error);
      } else {
        const r = await createInvoice(projectId, input);
        if (!r.ok) return setError(r.error);
        invoiceId = r.id;
      }
      if (file && invoiceId) {
        const body = new FormData();
        body.set("mode", "create");
        body.set("file", file);
        body.set("propertyId", propertyId);
        body.set("entityType", "invoice");
        body.set("entityId", invoiceId);
        if (invoiceCategoryId) body.set("categoryId", invoiceCategoryId);
        body.set("name", `Fatura ${input.number}`);
        body.set("docDate", input.issueDate);
        const res = await fetch("/api/documents/upload", { method: "POST", body });
        if (!res.ok) return setError("Fatura guardada, mas o PDF não foi carregado: " + ((await res.json().catch(() => ({}))).error ?? res.status));
        const { documentId } = (await res.json()) as { documentId: string };
        const a = await attachInvoiceDocument(invoiceId, documentId);
        if (!a.ok) return setError(a.error);
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-2xl">
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>{invoice ? `Fatura ${invoice.number}` : "Nova fatura"}</DialogTitle>
            <DialogDescription>Valores em euros. O PDF fica arquivado nos Documentos da obra.</DialogDescription>
          </DialogHeader>
          <div className="my-4 grid gap-3 sm:grid-cols-2">
            <FormField id="inv-supplier" label="Fornecedor">
              <NativeSelect id="inv-supplier" name="supplierId" defaultValue={invoice?.supplierId ?? ""} required>
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="inv-number" label="N.º da fatura">
              <Input id="inv-number" name="number" defaultValue={invoice?.number ?? ""} required />
            </FormField>
            <FormField id="inv-issue" label="Data da fatura">
              <Input id="inv-issue" name="issueDate" type="date" defaultValue={invoice?.issueDate ?? new Date().toISOString().slice(0, 10)} required />
            </FormField>
            <FormField id="inv-due" label="Vencimento">
              <Input id="inv-due" name="dueDate" type="date" defaultValue={invoice?.dueDate ?? ""} />
            </FormField>
            <FormField id="inv-net" label="Valor sem IVA (€)">
              <Input id="inv-net" inputMode="decimal" value={net || ""} onChange={(e) => setNet(Number(e.target.value.replace(",", ".")) || 0)} onFocus={(e) => e.target.select()} required />
            </FormField>
            <FormField id="inv-vat" label="IVA">
              <div className="flex items-center gap-2">
                <NativeSelect id="inv-vat" value={String(vatRate)} onChange={(e) => setVatRate(Number(e.target.value))} className="w-24">
                  <option value="0.23">23 %</option><option value="0.13">13 %</option><option value="0.06">6 %</option><option value="0">0 %</option>
                </NativeSelect>
                <span className="text-sm tabular-nums text-muted-foreground">{formatMoney(vat)}</span>
              </div>
            </FormField>
            <div className="rounded-lg bg-muted/50 px-3 py-2 sm:col-span-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Total c/ IVA</span>
              <span className="ml-3 text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
            </div>
            <FormField id="inv-measurement" label="Auto de medição (opcional)" hint={measurement ? `Auto: ${formatMoney(measurement.total)} s/ IVA${Math.abs(measurement.total - net) > 0.5 ? " · diferente do líquido" : " · igual"}` : "Compara a fatura com o auto do mês."}>
              <NativeSelect id="inv-measurement" value={measurementId} onChange={(e) => setMeasurementId(e.target.value)}>
                <option value="">—</option>
                {measurements.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="inv-file" label={invoice?.documentId ? "Substituir PDF (opcional)" : "PDF da fatura"}>
              <Input id="inv-file" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </FormField>
            <FormField id="inv-desc" label="Descrição" className="sm:col-span-2">
              <Input id="inv-desc" name="description" defaultValue={invoice?.description ?? ""} placeholder="Ex.: 1.ª fase eletricidade" />
            </FormField>
            <FormField id="inv-notes" label="Observações" className="sm:col-span-2">
              <Textarea id="inv-notes" name="notes" rows={2} defaultValue={invoice?.notes ?? ""} />
            </FormField>
          </div>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "A guardar…" : "Guardar fatura"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
