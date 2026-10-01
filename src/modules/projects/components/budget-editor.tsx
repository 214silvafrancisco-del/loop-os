"use client";

import { Check, ChevronDown, ChevronRight, FileSpreadsheet, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/core/lib/format";
import { saveBudget, seedBudgetFromBusinessPlan } from "../budget/actions";
import { assignCodes, chaptersWithoutSupplier, childrenOf, computeTotals, flatten, importedToNodes, inheritSuppliers, isLeaf, type BudgetNode, type ImportedNode } from "../budget/tree";
import { BudgetMobile } from "./budget-mobile";

type Option = { id: string; name: string };
type SupplierOption = Option & { controlMode: "autos" | "fatura" };
type Props = {
  projectId: string;
  initialNodes: BudgetNode[];
  suppliers: SupplierOption[];
  categories: Option[];
  defaultVatRate: number;
  hasBusinessPlanBudget: boolean;
};

const UNITS = ["vg", "un", "m²", "ml", "m³", "h", "kg"];
let tmpCounter = 0;
const tmpId = () => `tmp-${Date.now()}-${++tmpCounter}`;

function cell(extra = "") {
  return cn("h-7 w-full rounded border bg-background px-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", extra);
}

/**
 * Orçamento por fornecedor: uma secção por fornecedor da obra, com os seus
 * capítulos → subcapítulos → artigos. O fornecedor define-se no capítulo e
 * herda-se para baixo.
 */
export function BudgetEditor({ projectId, initialNodes, suppliers, categories, defaultVatRate, hasBusinessPlanBudget }: Props) {
  const router = useRouter();
  const [rawNodes, setNodes] = useState<BudgetNode[]>(initialNodes);
  const [saved, setSaved] = useState(JSON.stringify(inheritSuppliers(initialNodes)));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSupplierId, setImportSupplierId] = useState(suppliers[0]?.id ?? "");
  const fileInput = useRef<HTMLInputElement>(null);

  const nodes = useMemo(() => inheritSuppliers(rawNodes), [rawNodes]);
  const totals = useMemo(() => computeTotals(nodes), [nodes]);
  const codes = useMemo(() => assignCodes(nodes), [nodes]);
  const rows = useMemo(() => flatten(nodes), [nodes]);
  const dirty = JSON.stringify(nodes) !== saved;
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "Sem fornecedor";
  const missingSuppliers = chaptersWithoutSupplier(nodes);

  function update(id: string, patch: Partial<BudgetNode>) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }
  function add(parentId: string | null, supplierId: string | null = null): string {
    const id = tmpId();
    setNodes((prev) => {
      const siblings = childrenOf(prev, parentId);
      return [
        ...prev,
        {
          id,
          parentId,
          sort: (siblings.at(-1)?.sort ?? 0) + 1,
          description: "",
          categoryId: null,
          supplierId: parentId ? null : supplierId,
          quantity: parentId ? 1 : null,
          unit: parentId ? "vg" : null,
          unitPrice: parentId ? 0 : null,
          vatRate: defaultVatRate,
          notes: null,
        },
      ];
    });
    if (parentId) setCollapsed((c) => { const n = new Set(c); n.delete(parentId); return n; });
    return id;
  }
  function remove(id: string) {
    const descendants = new Set<string>();
    const collect = (pid: string) => { for (const c of childrenOf(nodes, pid)) { descendants.add(c.id); collect(c.id); } };
    collect(id);
    if (descendants.size && !confirm("Apagar esta linha e as suas sublinhas?")) return;
    removeSilently(id, descendants);
  }
  function removeSilently(id: string, descendants?: Set<string>) {
    const drop = descendants ?? new Set<string>();
    if (!descendants) {
      const collect = (pid: string) => { for (const c of childrenOf(nodes, pid)) { drop.add(c.id); collect(c.id); } };
      collect(id);
    }
    setNodes((prev) => prev.filter((n) => n.id !== id && !drop.has(n.id)));
  }
  function move(id: string, dir: -1 | 1) {
    setNodes((prev) => {
      const node = prev.find((n) => n.id === id)!;
      const siblings = childrenOf(prev, node.parentId);
      const idx = siblings.findIndex((s) => s.id === id);
      const other = siblings[idx + dir];
      if (!other) return prev;
      return prev.map((n) => (n.id === id ? { ...n, sort: other.sort } : n.id === other.id ? { ...n, sort: node.sort } : n));
    });
  }
  function toggle(id: string) {
    setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function save() {
    setError(null);
    if (missingSuppliers.length) {
      setError(`Escolhe o fornecedor de: ${missingSuppliers.map((c) => c.description || "capítulo sem nome").join(", ")}.`);
      return;
    }
    startTransition(async () => {
      const r = await saveBudget(projectId, nodes);
      if (!r.ok) return setError(r.error);
      const mapped = nodes.map((n) => ({ ...n, id: r.idMap[n.id] ?? n.id, parentId: n.parentId ? (r.idMap[n.parentId] ?? n.parentId) : null }));
      setNodes(mapped);
      setSaved(JSON.stringify(inheritSuppliers(mapped)));
      router.refresh();
    });
  }
  function seed() {
    startTransition(async () => {
      const r = await seedBudgetFromBusinessPlan(projectId);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }
  async function importExcel(file: File) {
    if (!importSupplierId) {
      setError("Cria primeiro o fornecedor a que este orçamento pertence.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/projects/${projectId}/budget/import`, { method: "POST", body });
      const json = (await res.json()) as { error?: string; tree?: ImportedNode[]; total?: number; skipped?: number };
      if (!res.ok || !json.tree) throw new Error(json.error ?? `Erro ${res.status}`);
      const mine = childrenOf(nodes, null).filter((c) => c.supplierId === importSupplierId);
      const replace = mine.length > 0 && confirm(`Encontrei ${json.tree.length} capítulos, total ${formatMoney(json.total ?? 0)} s/ IVA, para ${supplierName(importSupplierId)}.\n\nOK = substituir o orçamento deste fornecedor · Cancelar = juntar ao existente`);
      const startSort = childrenOf(nodes, null).at(-1)?.sort ?? 0;
      const imported = importedToNodes(json.tree, startSort, defaultVatRate, importSupplierId);
      if (replace) {
        const drop = new Set<string>();
        const collect = (pid: string) => { for (const c of childrenOf(nodes, pid)) { drop.add(c.id); collect(c.id); } };
        for (const c of mine) { drop.add(c.id); collect(c.id); }
        setNodes([...nodes.filter((n) => !drop.has(n.id)), ...imported]);
      } else {
        setNodes([...nodes, ...imported]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na importação.");
    } finally {
      setImporting(false);
    }
  }

  const hiddenByCollapse = (id: string): boolean => {
    let cur = nodes.find((n) => n.id === id);
    while (cur?.parentId) {
      if (collapsed.has(cur.parentId)) return true;
      cur = nodes.find((n) => n.id === cur!.parentId);
    }
    return false;
  };

  // Secções: um bloco por fornecedor, mais "sem fornecedor" se houver capítulos soltos.
  const chapters = childrenOf(nodes, null);
  const sections: { supplier: SupplierOption | null; chapters: BudgetNode[] }[] = [
    ...suppliers.map((s) => ({ supplier: s, chapters: chapters.filter((c) => c.supplierId === s.id) })),
    ...(chapters.some((c) => !c.supplierId) ? [{ supplier: null, chapters: chapters.filter((c) => !c.supplierId) }] : []),
  ];
  const rowsByRoot = new Map<string, typeof rows>();
  for (const r of rows) {
    let cur = r.node;
    while (cur.parentId) cur = nodes.find((n) => n.id === cur.parentId)!;
    if (!rowsByRoot.has(cur.id)) rowsByRoot.set(cur.id, []);
    rowsByRoot.get(cur.id)!.push(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Orçamentado s/ IVA</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(totals.totalNet)}</p>
          <p className="text-xs text-muted-foreground">c/ IVA {formatMoney(totals.totalGross)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Por fornecedor</p>
          <ul className="max-h-24 overflow-auto text-xs">
            {totals.bySupplier.map((s) => (
              <li key={s.supplierId ?? "none"} className="flex justify-between gap-2"><span className="truncate">{supplierName(s.supplierId)}</span><span className="tabular-nums">{formatMoney(s.net)}</span></li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Por capítulo</p>
          <ul className="max-h-24 overflow-auto text-xs">
            {totals.byChapter.map((c) => (
              <li key={c.id} className="flex justify-between gap-2"><span className="truncate">{c.description || "—"}</span><span className="tabular-nums">{formatMoney(c.net)}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border bg-card pl-2 text-xs text-muted-foreground">
          Importar Excel para
          <select value={importSupplierId} onChange={(e) => setImportSupplierId(e.target.value)} className="h-8 rounded-r-md bg-transparent px-1 text-xs text-foreground outline-none" aria-label="Fornecedor da importação">
            {suppliers.length === 0 ? <option value="">— cria um fornecedor —</option> : null}
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </span>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => fileInput.current?.click()} disabled={importing || !importSupplierId}>
          <FileSpreadsheet className="size-4" /> {importing ? "A ler…" : "Importar Excel"}
        </Button>
        <input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importExcel(f); e.target.value = ""; }} />
        {nodes.length === 0 && hasBusinessPlanBudget ? (
          <Button size="sm" variant="outline" className="gap-1" onClick={seed} disabled={pending}><Sparkles className="size-4" /> Começar pelo valor do Business Plan</Button>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
          <Button size="sm" className="gap-1" onClick={save} disabled={!dirty || pending}>
            <Check className="size-4" /> {pending ? "…" : dirty ? "Guardar orçamento" : "Guardado"}
          </Button>
        </span>
      </div>

      {suppliers.length === 0 && nodes.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Adiciona primeiro os fornecedores da obra (acima). Depois importa o mapa de quantidades de cada um ou cria os capítulos à mão.
        </p>
      ) : (
        <>
        {/* Telemóvel: leitura por fornecedor e capítulo, edição em diálogo. */}
        <div className="md:hidden">
          <BudgetMobile nodes={nodes} totals={totals} codes={codes} suppliers={suppliers} categories={categories} onUpdate={update} onAdd={add} onRemove={(id) => removeSilently(id)} />
        </div>
        <div className="hidden flex-col gap-4 md:flex">
          {sections.map(({ supplier, chapters: secChapters }) => {
            const net = secChapters.reduce((a, c) => a + (totals.byNode[c.id] ?? 0), 0);
            return (
              <section key={supplier?.id ?? "none"} className={cn("overflow-x-auto rounded-xl border bg-card", !supplier && "border-destructive/40")}>
                <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                  <h3 className="text-sm font-semibold">{supplier ? supplier.name : "Sem fornecedor"}</h3>
                  {supplier ? (
                    <span className={cn("rounded px-1.5 text-[11px]", supplier.controlMode === "autos" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {supplier.controlMode === "autos" ? "autos mensais" : "por fatura"}
                    </span>
                  ) : (
                    <span className="text-xs text-destructive">escolhe o fornecedor em cada capítulo</span>
                  )}
                  <span className="ml-auto text-sm font-semibold tabular-nums">{formatMoney(net)}</span>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => add(null, supplier?.id ?? null)}><Plus className="size-3.5" /> Capítulo</Button>
                </header>
                {secChapters.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground">Sem capítulos. Importa o Excel deste fornecedor ou adiciona um capítulo.</p>
                ) : (
                  <table className="w-full min-w-[56rem] text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="w-16 px-2 py-2 text-left">Cód.</th>
                        <th className="px-2 py-2 text-left">Descrição</th>
                        <th className="w-52 px-2 py-2 text-left">Fornecedor · Categoria</th>
                        <th className="w-20 px-2 py-2 text-right">Qtd</th>
                        <th className="w-16 px-2 py-2 text-left">Un</th>
                        <th className="w-24 px-2 py-2 text-right">Unitário</th>
                        <th className="w-16 px-2 py-2 text-right">IVA</th>
                        <th className="w-28 px-2 py-2 text-right">Orçamentado</th>
                        <th className="w-28 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {secChapters.flatMap((ch) => rowsByRoot.get(ch.id) ?? []).map(({ node: n, depth }) => {
                        if (hiddenByCollapse(n.id)) return null;
                        const leaf = isLeaf(nodes, n.id);
                        const chapter = depth === 0;
                        return (
                          <tr key={n.id} className={cn("border-t", chapter && "bg-muted/30 font-medium", !leaf && !chapter && "bg-muted/10")}>
                            <td className="px-2 py-1 font-mono text-xs text-muted-foreground">
                              <span className="flex items-center gap-0.5" style={{ paddingLeft: depth * 10 }}>
                                {!leaf ? (
                                  <button type="button" onClick={() => toggle(n.id)} className="rounded hover:bg-accent" aria-label="Expandir/colapsar">
                                    {collapsed.has(n.id) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                                  </button>
                                ) : <span className="inline-block w-3.5" />}
                                {codes[n.id]}
                              </span>
                            </td>
                            <td className="px-2 py-1">
                              <input value={n.description} onChange={(e) => update(n.id, { description: e.target.value })} placeholder={chapter ? "Capítulo" : leaf ? "Artigo" : "Subcapítulo"} className={cell(chapter ? "font-medium" : "")} style={{ marginLeft: depth * 6 }} />
                            </td>
                            <td className="px-2 py-1">
                              {chapter ? (
                                <span className="flex gap-1">
                                  <select value={n.supplierId ?? ""} onChange={(e) => update(n.id, { supplierId: e.target.value || null })} className={cell(!n.supplierId ? "border-destructive" : "")} aria-label="Fornecedor do capítulo">
                                    <option value="">— fornecedor —</option>
                                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>
                                  <select value={n.categoryId ?? ""} onChange={(e) => update(n.id, { categoryId: e.target.value || null })} className={cell("text-muted-foreground")} aria-label="Categoria">
                                    <option value="">— categoria —</option>
                                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2 py-1">{leaf ? <input type="number" step="0.001" min={0} value={n.quantity ?? ""} onChange={(e) => update(n.id, { quantity: e.target.value === "" ? null : Number(e.target.value) })} onFocus={(e) => e.target.select()} className={cell("text-right tabular-nums")} /> : null}</td>
                            <td className="px-2 py-1">{leaf ? <input list="unit-options" value={n.unit ?? ""} onChange={(e) => update(n.id, { unit: e.target.value || null })} className={cell()} /> : null}</td>
                            <td className="px-2 py-1">{leaf ? <input type="number" step="0.01" min={0} value={n.unitPrice ?? ""} onChange={(e) => update(n.id, { unitPrice: e.target.value === "" ? null : Number(e.target.value) })} onFocus={(e) => e.target.select()} className={cell("text-right tabular-nums")} /> : null}</td>
                            <td className="px-2 py-1">{leaf ? (
                              <select value={String(n.vatRate)} onChange={(e) => update(n.id, { vatRate: Number(e.target.value) })} className={cell("text-right")}>
                                <option value="0.23">23%</option><option value="0.06">6%</option><option value="0.13">13%</option><option value="0">0%</option>
                              </select>
                            ) : null}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{formatMoney(totals.byNode[n.id] ?? 0)}</td>
                            <td className="px-1 py-1">
                              <span className="flex justify-end gap-0.5">
                                {!leaf || chapter || depth < 2 ? (
                                  <button type="button" title={chapter ? "Adicionar subcapítulo/artigo" : "Adicionar artigo"} onClick={() => add(n.id)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="size-3.5" /></button>
                                ) : null}
                                <button type="button" title="Subir" onClick={() => move(n.id, -1)} className="rounded p-1 text-muted-foreground hover:bg-accent">↑</button>
                                <button type="button" title="Descer" onClick={() => move(n.id, 1)} className="rounded p-1 text-muted-foreground hover:bg-accent">↓</button>
                                <button type="button" title="Apagar" onClick={() => remove(n.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
          <datalist id="unit-options">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">Valores sem IVA, como no mapa de quantidades. O fornecedor define-se no capítulo e aplica-se a todas as suas linhas; os pais somam os artigos.</p>
      {/* Telemóvel: barra fixa de guardar por cima da navegação inferior. */}
      {dirty ? (
        <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-2 border-t bg-background/95 px-4 py-2 backdrop-blur md:hidden">
          {error ? <span className="min-w-0 flex-1 truncate text-xs text-destructive">{error}</span> : <span className="flex-1 text-xs text-muted-foreground">Alterações por guardar</span>}
          <Button className="h-11 gap-1" onClick={save} disabled={pending}>
            <Check className="size-4" /> {pending ? "…" : "Guardar orçamento"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
