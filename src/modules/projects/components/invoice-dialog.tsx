"use client";

import { FileSearch, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/core/lib/format";
import { FormField, NativeSelect } from "@/core/ui/form-field";
import { attachInvoiceDocument, createInvoice, updateInvoice, type InvoiceInput } from "../invoices/actions";
import type { ExtractedInvoice } from "../invoices/extract";
import type { InvoiceRow } from "../invoices/queries";
import { workInvoiceNet } from "../measurements/advance";

export type SupplierOption = { id: string; name: string; controlMode: "autos" | "fatura"; nif?: string | null };
export type MeasurementOption = {
  id: string;
  number: number;
  label: string;
  /** Valor do auto: trabalho executado ou valor do adiantamento. */
  total: number;
  supplierId: string;
  kind: "trabalho" | "adiantamento";
  /** % de adiantamento em vigor para o fornecedor (fração), aplicada aos autos de trabalho. */
  advancePct: number;
};

const pctLabel = (p: number) => `${Math.round(p * 10000) / 100} %`;

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  propertyId: string;
  suppliers: SupplierOption[];
  measurements: MeasurementOption[];
  invoice?: InvoiceRow | null;
  invoiceCategoryId: string | null;
  /** NIF da empresa: aparece nas faturas como cliente e não é do fornecedor. */
  ownNif?: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const FIELD_LABEL: Record<string, string> = { number: "número", issueDate: "data", dueDate: "vencimento", netAmount: "valor s/ IVA", vatRate: "taxa de IVA", vatAmount: "IVA", total: "total" };

/**
 * Fatura de um fornecedor da obra. Carregar o PDF primeiro lê os dados por
 * regras (número, datas, valores, NIF) e pré-preenche o formulário; o
 * utilizador confirma. Ligada a um auto, o líquido é calculado pelo auto.
 */
export function InvoiceDialog({ open, onClose, projectId, propertyId, suppliers, measurements, invoice, invoiceCategoryId, ownNif }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(invoice?.projectSupplierId ?? suppliers[0]?.id ?? "");
  const [number, setNumber] = useState(invoice?.number ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "");
  const [net, setNet] = useState(invoice ? Number(invoice.netAmount) : 0);
  const [vatRate, setVatRate] = useState(invoice ? Number(invoice.vatRate) : 0.23);
  const [measurementId, setMeasurementId] = useState(invoice?.measurementReportId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<{ ok: string[]; warnings: string[]; pdfNet: number | null } | null>(null);
  const vat = r2(net * vatRate);
  const total = r2(net + vat);
  const supplier = suppliers.find((s) => s.id === supplierId);
  const supplierMeasurements = measurements.filter((m) => m.supplierId === supplierId);
  const measurement = supplierMeasurements.find((m) => m.id === measurementId);
  // Ligada a um auto, o líquido é calculado: adiantamento = valor; trabalho = valor × (1 − % adiantamento).
  const computedNet = measurement ? (measurement.kind === "adiantamento" ? measurement.total : workInvoiceNet(measurement.total, measurement.advancePct)) : null;
  const pdfDiffers = readNote?.pdfNet !== null && readNote?.pdfNet !== undefined && computedNet !== null && Math.abs(readNote.pdfNet - computedNet) > 0.5;

  function pickMeasurement(id: string) {
    setMeasurementId(id);
    const m = supplierMeasurements.find((x) => x.id === id);
    if (m) setNet(m.kind === "adiantamento" ? m.total : workInvoiceNet(m.total, m.advancePct));
  }

  /** Lê o PDF e pré-preenche o que reconheceu; nunca apaga o que já está escrito. */
  async function readPdf(f: File) {
    setReading(true);
    setReadNote(null);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", f);
      const res = await fetch(`/api/projects/${projectId}/invoices/extract`, { method: "POST", body });
      const json = (await res.json()) as { error?: string; extracted?: ExtractedInvoice; note?: string };
      if (!res.ok || !json.extracted) throw new Error(json.error ?? `Erro ${res.status}`);
      const x = json.extracted;
      if (x.number && !number) setNumber(x.number);
      if (x.issueDate) setIssueDate(x.issueDate);
      if (x.dueDate) setDueDate(x.dueDate);
      if (x.vatRate !== null) setVatRate(x.vatRate);
      if (x.netAmount !== null && !measurement) setNet(x.netAmount);
      // Fornecedor pelo NIF (ignora o NIF da empresa).
      const own = (ownNif ?? "").replace(/\D/g, "");
      const candidate = x.nifs.map((n) => n.replace(/\D/g, "")).find((n) => n !== own);
      const match = candidate ? suppliers.find((s) => (s.nif ?? "").replace(/\D/g, "") === candidate) : undefined;
      if (match && match.id !== supplierId) {
        setSupplierId(match.id);
        setMeasurementId("");
      }
      const ok = x.found.map((k) => FIELD_LABEL[k] ?? k);
      if (match) ok.push(`fornecedor ${match.name} (NIF)`);
      const warnings = [...x.warnings];
      if (json.note) warnings.push(json.note);
      if (candidate && !match) warnings.push(`NIF ${candidate} no PDF não corresponde a nenhum fornecedor desta obra.`);
      setReadNote({ ok, warnings, pdfNet: x.netAmount });
    } catch (e) {
      setReadNote({ ok: [], warnings: [e instanceof Error ? e.message : "Não foi possível ler o PDF."], pdfNet: null });
    } finally {
      setReading(false);
    }
  }

  function submit(formData: FormData) {
    setError(null);
    const input: InvoiceInput = {
      projectSupplierId: supplierId,
      number,
      issueDate,
      dueDate: dueDate || null,
      description: String(formData.get("description") ?? "") || null,
      netAmount: net,
      vatRate,
      vatAmount: vat,
      total,
      measurementReportId: supplier?.controlMode === "autos" && measurementId ? measurementId : null,
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
            <DialogDescription>Carrega o PDF: a app lê número, datas e valores e tu confirmas. O PDF fica arquivado nos Documentos da obra.</DialogDescription>
          </DialogHeader>
          <div className="my-4 grid gap-3 sm:grid-cols-2">
            <FormField id="inv-file" label={invoice?.documentId ? "Substituir PDF (opcional)" : "PDF da fatura"} className="sm:col-span-2" hint={reading ? "A ler o PDF…" : undefined}>
              <div className="flex items-center gap-2">
                <Input
                  id="inv-file"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name))) void readPdf(f);
                    else if (f) setReadNote({ ok: [], warnings: ["Só leio PDFs; para imagens preenche os campos à mão."], pdfNet: null });
                  }}
                />
                {reading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <FileSearch className="size-4 text-muted-foreground" />}
              </div>
              {readNote ? (
                <div className="mt-1 text-xs">
                  {readNote.ok.length ? <p className="text-success">Lido do PDF: {readNote.ok.join(", ")}. Confirma antes de guardar.</p> : null}
                  {readNote.warnings.map((w) => (
                    <p key={w} className="text-warning">{w}</p>
                  ))}
                  {pdfDiffers ? <p className="text-warning">O PDF indica {formatMoney(readNote.pdfNet ?? 0)} s/ IVA, mas o auto ligado dá {formatMoney(computedNet ?? 0)}.</p> : null}
                </div>
              ) : null}
            </FormField>
            <FormField id="inv-supplier" label="Fornecedor da obra" hint={suppliers.length === 0 ? "Adiciona fornecedores na tab Orçamento." : undefined}>
              <NativeSelect
                id="inv-supplier"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setMeasurementId("");
                }}
                required
              >
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </FormField>
            {supplier?.controlMode === "autos" ? (
              <FormField
                id="inv-measurement"
                label="Auto a que se refere"
                hint={measurement ? (measurement.kind === "adiantamento" ? "Fatura de adiantamento." : "Fatura do auto de trabalho, já com o desconto do adiantamento.") : supplierMeasurements.length ? "Ligada a um auto, o valor sem IVA é calculado automaticamente." : "Este fornecedor ainda não tem autos fechados."}
              >
                <NativeSelect id="inv-measurement" value={measurementId} onChange={(e) => pickMeasurement(e.target.value)} disabled={supplierMeasurements.length === 0}>
                  <option value="">— sem auto —</option>
                  {supplierMeasurements.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </NativeSelect>
              </FormField>
            ) : supplier ? (
              <p className="self-end text-xs text-muted-foreground">{supplier.name} é controlado por fatura: compara-se com o orçamentado dele.</p>
            ) : null}
            <FormField id="inv-number" label="N.º da fatura">
              <Input id="inv-number" value={number} onChange={(e) => setNumber(e.target.value)} required />
            </FormField>
            <FormField id="inv-issue" label="Data da fatura">
              <Input id="inv-issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </FormField>
            <FormField id="inv-due" label="Vencimento">
              <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FormField>
            <FormField
              id="inv-net"
              label="Valor sem IVA (€)"
              hint={
                measurement && computedNet !== null
                  ? measurement.kind === "adiantamento"
                    ? `Fatura de adiantamento: igual ao auto (${formatMoney(measurement.total)}).`
                    : measurement.advancePct > 0
                      ? `Auto ${formatMoney(measurement.total)} × (1 − ${pctLabel(measurement.advancePct)}) = ${formatMoney(computedNet)}`
                      : `Sem adiantamento: igual ao auto (${formatMoney(measurement.total)}).`
                  : undefined
              }
            >
              <Input id="inv-net" inputMode="decimal" value={net || ""} onChange={(e) => setNet(Number(e.target.value.replace(",", ".")) || 0)} onFocus={(e) => e.target.select()} readOnly={measurement !== undefined} className={measurement ? "bg-muted/50" : undefined} required />
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
            <Button type="submit" disabled={pending || reading || !supplierId}>{pending ? "A guardar…" : "Guardar fatura"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
