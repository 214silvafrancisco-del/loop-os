"use client";

import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/core/lib/format";
import { FormField, NativeSelect } from "@/core/ui/form-field";
import { childrenOf, isLeaf, type BudgetNode, type BudgetTotals } from "../budget/tree";

type Option = { id: string; name: string };
type SupplierOption = Option & { controlMode: "autos" | "fatura" };

type Props = {
  nodes: BudgetNode[];
  totals: BudgetTotals;
  codes: Record<string, string>;
  suppliers: SupplierOption[];
  categories: Option[];
  onUpdate: (id: string, patch: Partial<BudgetNode>) => void;
  onAdd: (parentId: string | null, supplierId?: string | null) => string;
  onRemove: (id: string) => void;
};

/**
 * Orçamento no telemóvel: leitura por fornecedor e capítulo, com totais;
 * tocar numa linha abre um diálogo para editar. Partilha o estado com o
 * editor de desktop; guardar é o mesmo botão.
 */
export function BudgetMobile({ nodes, totals, codes, suppliers, categories, onUpdate, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const chapters = childrenOf(nodes, null);
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "Sem fornecedor";
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const sections = [
    ...suppliers.map((s) => ({ supplier: s as SupplierOption | null, chapters: chapters.filter((c) => c.supplierId === s.id) })),
    ...(chapters.some((c) => !c.supplierId) ? [{ supplier: null, chapters: chapters.filter((c) => !c.supplierId) }] : []),
  ];

  function addChapter(supplierId: string | null) {
    const id = onAdd(null, supplierId);
    setEditing(id);
  }
  function addArticle(parentId: string) {
    const id = onAdd(parentId);
    setOpen((o) => new Set(o).add(parentId));
    setEditing(id);
  }

  const editingNode = editing ? nodes.find((n) => n.id === editing) ?? null : null;

  return (
    <div className="flex flex-col gap-3">
      {sections.map(({ supplier, chapters: secChapters }) => {
        const net = secChapters.reduce((a, c) => a + (totals.byNode[c.id] ?? 0), 0);
        return (
          <section key={supplier?.id ?? "none"} className={cn("rounded-xl border bg-card", !supplier && "border-destructive/40")}>
            <header className="flex items-center gap-2 border-b px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{supplier ? supplier.name : "Sem fornecedor"}</h3>
                {supplier ? <p className="text-[11px] text-muted-foreground">{supplier.controlMode === "autos" ? "autos mensais" : "por fatura"}</p> : <p className="text-[11px] text-destructive">escolhe o fornecedor em cada capítulo</p>}
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatMoney(net)}</span>
              <Button size="icon" variant="ghost" className="size-11" aria-label="Novo capítulo" onClick={() => addChapter(supplier?.id ?? null)}>
                <Plus className="size-5" />
              </Button>
            </header>
            {secChapters.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">Sem capítulos.</p>
            ) : (
              <ul className="divide-y">
                {secChapters.map((ch) => {
                  const expanded = open.has(ch.id);
                  const rows = descendantsInOrder(nodes, ch.id);
                  return (
                    <li key={ch.id}>
                      <div className="flex items-center gap-1 pr-1">
                        <button type="button" onClick={() => toggle(ch.id)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3 text-left">
                          {expanded ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                          <span className="font-mono text-[11px] text-muted-foreground">{codes[ch.id]}</span>
                          <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", !ch.description && "italic text-muted-foreground")}>{ch.description || "Capítulo sem nome"}</span>
                          <span className="text-sm tabular-nums">{formatMoney(totals.byNode[ch.id] ?? 0)}</span>
                        </button>
                        <Button size="sm" variant="ghost" className="h-11 px-2 text-xs" onClick={() => setEditing(ch.id)}>
                          Editar
                        </Button>
                      </div>
                      {expanded ? (
                        <ul className="border-t bg-muted/20">
                          {rows.map(({ node: n, depth }) => {
                            const leaf = isLeaf(nodes, n.id);
                            return (
                              <li key={n.id}>
                                <button type="button" onClick={() => setEditing(n.id)} className="flex min-h-12 w-full items-center gap-2 py-2 pr-3 text-left" style={{ paddingLeft: 12 + depth * 12 }}>
                                  <span className="font-mono text-[11px] text-muted-foreground">{codes[n.id]}</span>
                                  <span className="min-w-0 flex-1">
                                    <span className={cn("block truncate text-sm", !leaf && "font-medium", !n.description && "italic text-muted-foreground")}>{n.description || (leaf ? "Artigo sem nome" : "Subcapítulo sem nome")}</span>
                                    {leaf ? (
                                      <span className="block text-[11px] text-muted-foreground">
                                        {n.quantity ?? 0} {n.unit ?? ""} × {formatMoney(n.unitPrice ?? 0)} · IVA {Math.round(n.vatRate * 100)} %
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="text-sm tabular-nums">{formatMoney(totals.byNode[n.id] ?? 0)}</span>
                                </button>
                              </li>
                            );
                          })}
                          <li>
                            <Button variant="ghost" size="sm" className="h-11 w-full justify-start gap-1 px-3 text-xs" onClick={() => addArticle(ch.id)}>
                              <Plus className="size-4" /> Artigo em {ch.description || "este capítulo"}
                            </Button>
                          </li>
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <LineDialog
        node={editingNode}
        nodes={nodes}
        parentSupplierName={editingNode ? supplierName(editingNode.supplierId) : ""}
        suppliers={suppliers}
        categories={categories}
        onClose={() => setEditing(null)}
        onUpdate={onUpdate}
        onRemove={(id) => {
          setEditing(null);
          onRemove(id);
        }}
      />
    </div>
  );
}

/** Descendentes de um capítulo em pré-ordem, com profundidade relativa (1 = filho direto). */
function descendantsInOrder(nodes: BudgetNode[], rootId: string): { node: BudgetNode; depth: number }[] {
  const out: { node: BudgetNode; depth: number }[] = [];
  const walk = (parentId: string, depth: number) => {
    for (const n of childrenOf(nodes, parentId)) {
      out.push({ node: n, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(rootId, 1);
  return out;
}

function LineDialog({ node, nodes, parentSupplierName, suppliers, categories, onClose, onUpdate, onRemove }: {
  node: BudgetNode | null;
  nodes: BudgetNode[];
  parentSupplierName: string;
  suppliers: SupplierOption[];
  categories: Option[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<BudgetNode>) => void;
  onRemove: (id: string) => void;
}) {
  if (!node) return null;
  const chapter = node.parentId === null;
  const leaf = isLeaf(nodes, node.id);
  const num = (v: string) => (v === "" ? null : Number(v.replace(",", ".")) || 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{chapter ? "Capítulo" : leaf ? "Artigo" : "Subcapítulo"}</DialogTitle>
          <DialogDescription>{chapter ? "O fornecedor do capítulo aplica-se a todas as suas linhas." : `Fornecedor: ${parentSupplierName}. As alterações ficam guardadas com “Guardar orçamento”.`}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <FormField id="ln-desc" label="Descrição">
            <Input id="ln-desc" value={node.description} onChange={(e) => onUpdate(node.id, { description: e.target.value })} className="h-11 text-base" autoFocus />
          </FormField>
          {chapter ? (
            <>
              <FormField id="ln-sup" label="Fornecedor">
                <NativeSelect id="ln-sup" value={node.supplierId ?? ""} onChange={(e) => onUpdate(node.id, { supplierId: e.target.value || null })} className="h-11">
                  <option value="">— fornecedor —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </NativeSelect>
              </FormField>
              <FormField id="ln-cat" label="Categoria">
                <NativeSelect id="ln-cat" value={node.categoryId ?? ""} onChange={(e) => onUpdate(node.id, { categoryId: e.target.value || null })} className="h-11">
                  <option value="">— categoria —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </FormField>
            </>
          ) : null}
          {leaf ? (
            <div className="grid grid-cols-3 gap-2">
              <FormField id="ln-qty" label="Qtd">
                <Input id="ln-qty" inputMode="decimal" value={node.quantity ?? ""} onChange={(e) => onUpdate(node.id, { quantity: num(e.target.value) })} onFocus={(e) => e.target.select()} className="h-11 text-base" />
              </FormField>
              <FormField id="ln-unit" label="Un">
                <Input id="ln-unit" value={node.unit ?? ""} onChange={(e) => onUpdate(node.id, { unit: e.target.value || null })} className="h-11 text-base" />
              </FormField>
              <FormField id="ln-price" label="Unitário €">
                <Input id="ln-price" inputMode="decimal" value={node.unitPrice ?? ""} onChange={(e) => onUpdate(node.id, { unitPrice: num(e.target.value) })} onFocus={(e) => e.target.select()} className="h-11 text-base" />
              </FormField>
              <FormField id="ln-vat" label="IVA" className="col-span-3">
                <NativeSelect id="ln-vat" value={String(node.vatRate)} onChange={(e) => onUpdate(node.id, { vatRate: Number(e.target.value) })} className="h-11">
                  <option value="0.23">23 %</option><option value="0.06">6 %</option><option value="0.13">13 %</option><option value="0">0 %</option>
                </NativeSelect>
              </FormField>
              <p className="col-span-3 text-right text-sm">
                Orçamentado: <span className="font-semibold tabular-nums">{formatMoney((node.quantity ?? 0) * (node.unitPrice ?? 0))}</span>
              </p>
            </div>
          ) : null}
        </div>
        <DialogFooter className="flex-row justify-between gap-2">
          <Button type="button" variant="ghost" className="h-11 gap-1 text-destructive" onClick={() => { if (confirm("Apagar esta linha" + (leaf ? "?" : " e as suas sublinhas?"))) onRemove(node.id); }}>
            <Trash2 className="size-4" /> Apagar
          </Button>
          <Button type="button" className="h-11" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
