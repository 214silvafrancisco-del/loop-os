"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/core/lib/format";
import { FormField } from "@/core/ui/form-field";
import { createAdvanceMeasurement, finalizeAdvanceMeasurement, type AdvanceInput } from "../measurements/actions";
import { suggestAdvancePct } from "../measurements/advance";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  propertyId: string;
  supplier: { id: string; name: string; budgeted: number };
  nextNumber: number;
  documentCategoryId: string | null;
};

/** Novo auto de adiantamento: valor, percentagem (sugerida a partir do adjudicado), documento e observações. */
export function AdvanceAutoDialog({ open, onClose, projectId, propertyId, supplier, nextNumber, documentCategoryId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [pct, setPct] = useState<number>(0);
  const [pctTouched, setPctTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  function changeAmount(v: number) {
    setAmount(v);
    if (!pctTouched) setPct(Math.round(suggestAdvancePct(v, supplier.budgeted) * 10000) / 100);
  }

  function submit(formData: FormData) {
    setError(null);
    const numberRaw = String(formData.get("number") ?? "").trim();
    const input: AdvanceInput = {
      projectSupplierId: supplier.id,
      number: numberRaw === "" ? null : Number(numberRaw),
      reportDate: String(formData.get("reportDate") ?? ""),
      amount,
      advancePct: pct,
      notes: String(formData.get("notes") ?? "") || null,
    };
    startTransition(async () => {
      const r = await createAdvanceMeasurement(projectId, input);
      if (!r.ok) return setError(r.error);
      let documentId: string | null = null;
      if (file) {
        const body = new FormData();
        body.set("mode", "create");
        body.set("file", file);
        body.set("propertyId", propertyId);
        body.set("entityType", "measurement_report");
        body.set("entityId", r.id);
        if (documentCategoryId) body.set("categoryId", documentCategoryId);
        body.set("name", `Auto de adiantamento n.º ${input.number ?? nextNumber} · ${supplier.name}`);
        body.set("docDate", input.reportDate);
        const res = await fetch("/api/documents/upload", { method: "POST", body });
        if (res.ok) documentId = ((await res.json()) as { documentId: string }).documentId;
        else setError("Auto criado, mas o documento não foi carregado: " + ((await res.json().catch(() => ({}))).error ?? res.status));
      }
      const f = await finalizeAdvanceMeasurement(r.id, documentId);
      if (!f.ok) return setError(f.error);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-lg">
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>Auto de adiantamento · {supplier.name}</DialogTitle>
            <DialogDescription>
              Corresponde à fatura de adiantamento, não a trabalho executado. A percentagem é descontada na fatura de cada auto de trabalho seguinte: fatura = auto × (1 − %).
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 grid gap-3 sm:grid-cols-2">
            <FormField id="adv-number" label="N.º do auto" hint={`Sugerido: ${nextNumber}`}>
              <Input id="adv-number" name="number" inputMode="numeric" defaultValue={String(nextNumber)} />
            </FormField>
            <FormField id="adv-date" label="Data">
              <Input id="adv-date" name="reportDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </FormField>
            <FormField id="adv-amount" label="Valor do adiantamento (€ s/ IVA)">
              <Input id="adv-amount" inputMode="decimal" value={amount || ""} onChange={(e) => changeAmount(Number(e.target.value.replace(",", ".")) || 0)} onFocus={(e) => e.target.select()} required />
            </FormField>
            <FormField id="adv-pct" label="Percentagem de adiantamento (%)" hint={supplier.budgeted > 0 ? `Adjudicado: ${formatMoney(supplier.budgeted)}` : "Sem orçamento do fornecedor para sugerir a percentagem."}>
              <Input
                id="adv-pct"
                inputMode="decimal"
                value={pct || ""}
                onChange={(e) => {
                  setPctTouched(true);
                  setPct(Number(e.target.value.replace(",", ".")) || 0);
                }}
                onFocus={(e) => e.target.select()}
                required
              />
            </FormField>
            <FormField id="adv-file" label="Documento do auto" className="sm:col-span-2">
              <Input id="adv-file" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </FormField>
            <FormField id="adv-notes" label="Observações" className="sm:col-span-2">
              <Textarea id="adv-notes" name="notes" rows={2} />
            </FormField>
          </div>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || amount <= 0}>
              {pending ? "A guardar…" : "Criar auto de adiantamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
