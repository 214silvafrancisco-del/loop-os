"use client";

import { Copy, FileUp, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/core/lib/format";
import { FormField, NativeSelect } from "@/core/ui/form-field";
import { createProjectSupplier, deleteProjectSupplier, updateProjectSupplier, type SupplierInput } from "../suppliers/actions";
import { CONTROL_MODE_LABEL, SUPPLIER_KINDS } from "../suppliers/constants";
import type { ReusableSupplier, SupplierRow } from "../suppliers/queries";
import type { ImportedNode } from "../budget/tree";

type ReadBudget = { tree: ImportedNode[]; total: number; doubts: string[]; items: number; header: { name: string | null; nif: string | null; phone: string | null; email: string | null } | null };

type Props = {
  projectId: string;
  suppliers: SupplierRow[];
  reusable: ReusableSupplier[];
  /** Compacto: só a lista e o botão (para o topo do Orçamento). */
  compact?: boolean;
};

type DialogState = { mode: "create"; preset?: ReusableSupplier } | { mode: "edit"; supplier: SupplierRow } | null;

/** Fornecedores desta obra: lista, criar (à mão ou reutilizando outra obra), editar, apagar. */
export function SuppliersPanel({ projectId, suppliers, reusable, compact }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const open = (d: Exclude<DialogState, null>) => {
    setDialogKey((k) => k + 1);
    setDialog(d);
  };

  function remove(s: SupplierRow) {
    if (!confirm(`Apagar o fornecedor "${s.name}" desta obra?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteProjectSupplier(s.id);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Users className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Fornecedores desta obra</h3>
        <span className="text-xs text-muted-foreground">{suppliers.length ? `${suppliers.length}` : "nenhum ainda"}</span>
        <span className="ml-auto flex items-center gap-2">
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
          {reusable.length ? (
            <NativeSelect
              aria-label="Reutilizar fornecedor de outra obra"
              value=""
              onChange={(e) => {
                const r = reusable[Number(e.target.value)];
                if (r) open({ mode: "create", preset: r });
              }}
              className="h-8 w-auto text-xs"
            >
              <option value="">Reutilizar de outra obra…</option>
              {reusable.map((r, i) => (
                <option key={r.name} value={i}>
                  {r.name} ({r.fromProject})
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <Button size="sm" variant="outline" className="gap-1" onClick={() => open({ mode: "create" })}>
            <Plus className="size-4" /> Fornecedor
          </Button>
        </span>
      </header>
      {suppliers.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Começa por adicionar os fornecedores (empreiteiro, carpinteiro, caixilheiro…). Cada capítulo do orçamento pertence a um deles, e cada um tem os seus autos ou as suas faturas.
        </p>
      ) : (
        <ul className={cn("divide-y", compact && "text-sm")}>
          {suppliers.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
              <span className="font-medium">{s.name}</span>
              {s.kind ? <span className="text-xs text-muted-foreground">{s.kind}</span> : null}
              <span className={cn("rounded px-1.5 text-[11px]", s.controlMode === "autos" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{CONTROL_MODE_LABEL[s.controlMode]}</span>
              {s.nif ? <span className="text-xs text-muted-foreground">NIF {s.nif}</span> : null}
              {s.phone ? <span className="text-xs text-muted-foreground">{s.phone}</span> : null}
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {s.chapterCount} cap. · {formatMoney(s.budgeted)}
                {s.measurementCount ? ` · ${s.measurementCount} auto${s.measurementCount > 1 ? "s" : ""}` : ""}
                {s.invoiceCount ? ` · ${s.invoiceCount} fat.` : ""}
              </span>
              <span className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="size-7" title="Editar" onClick={() => open({ mode: "edit", supplier: s })}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-destructive" title="Apagar" onClick={() => remove(s)} disabled={s.chapterCount + s.measurementCount + s.invoiceCount > 0}>
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <SupplierDialog key={dialogKey} state={dialog} projectId={projectId} onClose={() => setDialog(null)} />
    </section>
  );
}

function SupplierDialog({ state, projectId, onClose }: { state: DialogState; projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editing = state?.mode === "edit" ? state.supplier : null;
  const preset = state?.mode === "create" ? state.preset : undefined;
  const [budget, setBudget] = useState<ReadBudget | null>(null);
  const [reading, setReading] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const initial = budget?.header
    ? { name: budget.header.name ?? preset?.name ?? "", kind: preset?.kind ?? null, nif: budget.header.nif ?? preset?.nif ?? null, phone: budget.header.phone ?? preset?.phone ?? null, email: budget.header.email ?? preset?.email ?? null, controlMode: preset?.controlMode ?? ("autos" as const) }
    : (editing ?? preset ?? null);

  /** Lê um orçamento (PDF ou Excel): pré-preenche o fornecedor e guarda a árvore para o editor. */
  async function readBudget(file: File) {
    setReading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/projects/${projectId}/budget/import`, { method: "POST", body });
      const json = (await res.json()) as { error?: string } & Partial<ReadBudget>;
      if (!res.ok || !json.tree) throw new Error(json.error ?? `Erro ${res.status}`);
      setBudget({ tree: json.tree, total: json.total ?? 0, doubts: json.doubts ?? [], items: json.items ?? 0, header: json.header ?? null });
      setFormKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o orçamento.");
    } finally {
      setReading(false);
    }
  }

  function submit(formData: FormData) {
    setError(null);
    const input: SupplierInput = {
      name: String(formData.get("name") ?? ""),
      kind: String(formData.get("kind") ?? "") || null,
      nif: String(formData.get("nif") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      controlMode: (String(formData.get("controlMode") ?? "autos") as "autos" | "fatura"),
      notes: String(formData.get("notes") ?? "") || null,
    };
    startTransition(async () => {
      const r = editing ? await updateProjectSupplier(editing.id, input) : await createProjectSupplier(projectId, input);
      if (!r.ok) return setError(r.error);
      if (!editing && budget && "id" in r) {
        // O editor do orçamento (mesma página) apanha isto e junta a árvore a este fornecedor.
        try {
          sessionStorage.setItem(`loop:pendingImport:${projectId}`, JSON.stringify({ supplierId: r.id, tree: budget.tree, total: budget.total, doubts: budget.doubts }));
        } catch {
          /* sem storage: o utilizador importa à mão */
        }
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-lg">
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? editing.name : preset ? `Reutilizar ${preset.name}` : "Novo fornecedor"}</DialogTitle>
            <DialogDescription>
              {preset ? (
                <span className="inline-flex items-center gap-1">
                  <Copy className="size-3.5" /> Dados copiados de {preset.fromProject}. Confirma e ajusta.
                </span>
              ) : (
                "Fornecedor desta obra. Por autos mensais (empreiteiro) ou por fatura (quem entrega e fatura de uma vez)."
              )}
            </DialogDescription>
          </DialogHeader>
          {!editing ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
              <Button type="button" size="sm" variant="outline" className="h-9 gap-1" onClick={() => fileInput.current?.click()} disabled={reading || pending}>
                <FileUp className="size-4" /> {reading ? "A ler…" : "Carregar orçamento (PDF ou Excel)"}
              </Button>
              <input ref={fileInput} type="file" accept=".pdf,application/pdf,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readBudget(f); e.target.value = ""; }} />
              <span className="text-muted-foreground">
                {budget
                  ? `Lido: ${budget.tree.length} capítulos, ${budget.items} artigos, ${formatMoney(budget.total)} s/ IVA${budget.doubts.length ? ` · ${budget.doubts.length} a rever` : ""}. Ao adicionar, entra no orçamento atribuído a este fornecedor.`
                  : "Do PDF tiro nome, NIF, telefone e email; do Excel só os artigos."}
              </span>
            </div>
          ) : null}
          <div key={formKey} className="my-4 grid gap-3 sm:grid-cols-2">
            <FormField id="sup-name" label="Nome" className="sm:col-span-2">
              <Input id="sup-name" name="name" defaultValue={initial?.name ?? ""} required autoFocus />
            </FormField>
            <FormField id="sup-kind" label="Tipo">
              <Input id="sup-kind" name="kind" list="supplier-kinds" defaultValue={initial?.kind ?? ""} placeholder="Empreiteiro, Carpinteiro…" />
              <datalist id="supplier-kinds">
                {SUPPLIER_KINDS.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </FormField>
            <FormField id="sup-mode" label="Controlo">
              <NativeSelect id="sup-mode" name="controlMode" defaultValue={initial?.controlMode ?? "autos"}>
                <option value="autos">Autos de medição mensais</option>
                <option value="fatura">Por fatura (compara com o orçamentado)</option>
              </NativeSelect>
            </FormField>
            <FormField id="sup-nif" label="NIF">
              <Input id="sup-nif" name="nif" inputMode="numeric" defaultValue={initial?.nif ?? ""} />
            </FormField>
            <FormField id="sup-phone" label="Telefone">
              <Input id="sup-phone" name="phone" defaultValue={initial?.phone ?? ""} />
            </FormField>
            <FormField id="sup-email" label="Email" className="sm:col-span-2">
              <Input id="sup-email" name="email" type="email" defaultValue={initial?.email ?? ""} />
            </FormField>
            <FormField id="sup-notes" label="Notas" className="sm:col-span-2">
              <Textarea id="sup-notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
            </FormField>
          </div>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar…" : editing ? "Guardar" : budget ? "Adicionar e importar orçamento" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
