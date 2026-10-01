"use client";

import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NativeSelect } from "@/core/ui/form-field";

export type DealsFilterValues = {
  q: string;
  status: string;
  municipality: string;
  typology: string;
  source: string;
  owner: string;
  process: string;
  stage: string;
  view: "list" | "kanban";
};

type Option = { value: string; label: string };
type Props = {
  values: DealsFilterValues;
  municipalities: string[];
  typologies: string[];
  sources: Option[];
  users: Option[];
  stages: Option[];
};

const PROCESS_LABEL: Record<string, string> = { required_missing: "Com obrigatórios em falta", complete: "Procedimento completo" };
const STATUS_LABEL: Record<string, string> = { active: "Ativos", excluded: "Excluídos", all: "Todos" };

function hrefWithout(values: DealsFilterValues, key: keyof DealsFilterValues): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (k === key || !v) continue;
    if (k === "status" && v === "active") continue;
    p.set(k, v);
  }
  return `/deals?${p.toString()}`;
}

/**
 * Filtros da lista de negócios. Em desktop ficam em linha; no telemóvel a
 * pesquisa fica visível e o resto abre num painel de baixo, com chips do que
 * está ativo. Ambos submetem por GET, como antes.
 */
export function DealsFilters({ values, municipalities, typologies, sources, users, stages }: Props) {
  const [open, setOpen] = useState(false);
  const isList = values.view === "list";

  const chips: { key: keyof DealsFilterValues; label: string }[] = [];
  if (values.q) chips.push({ key: "q", label: `“${values.q}”` });
  if (isList && values.stage) chips.push({ key: "stage", label: stages.find((s) => s.value === values.stage)?.label ?? "Fase" });
  if (isList && values.status && values.status !== "active") chips.push({ key: "status", label: STATUS_LABEL[values.status] ?? values.status });
  if (values.municipality) chips.push({ key: "municipality", label: values.municipality });
  if (values.typology) chips.push({ key: "typology", label: values.typology });
  if (values.source) chips.push({ key: "source", label: sources.find((s) => s.value === values.source)?.label ?? "Fonte" });
  if (values.owner) chips.push({ key: "owner", label: users.find((u) => u.value === values.owner)?.label ?? "Responsável" });
  if (values.process) chips.push({ key: "process", label: PROCESS_LABEL[values.process] ?? values.process });
  const activeCount = chips.filter((c) => c.key !== "q").length;

  const selects = (
    <>
      {isList ? (
        <NativeSelect name="status" defaultValue={values.status || "active"} className="w-auto" aria-label="Estado">
          <option value="active">Ativos</option>
          <option value="excluded">Excluídos</option>
          <option value="all">Todos</option>
        </NativeSelect>
      ) : null}
      <NativeSelect name="municipality" defaultValue={values.municipality} className="w-auto" aria-label="Concelho">
        <option value="">Concelho</option>
        {municipalities.map((m) => <option key={m} value={m}>{m}</option>)}
      </NativeSelect>
      <NativeSelect name="typology" defaultValue={values.typology} className="w-auto" aria-label="Tipologia">
        <option value="">Tipologia</option>
        {typologies.map((t) => <option key={t} value={t}>{t}</option>)}
      </NativeSelect>
      <NativeSelect name="source" defaultValue={values.source} className="w-auto" aria-label="Fonte">
        <option value="">Fonte</option>
        {sources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </NativeSelect>
      <NativeSelect name="owner" defaultValue={values.owner} className="w-auto" aria-label="Responsável">
        <option value="">Responsável</option>
        {users.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
      </NativeSelect>
      <NativeSelect name="process" defaultValue={values.process} className="w-auto" aria-label="Procedimento">
        <option value="">Procedimento</option>
        <option value="required_missing">Com obrigatórios em falta</option>
        <option value="complete">Procedimento completo</option>
      </NativeSelect>
    </>
  );
  const hidden = (
    <>
      <input type="hidden" name="view" value={values.view} />
      {values.stage && isList ? <input type="hidden" name="stage" value={values.stage} /> : null}
    </>
  );

  return (
    <div className="mb-4 flex flex-col gap-2">
      {/* Desktop: tudo em linha */}
      <form className="hidden flex-wrap gap-2 md:flex" method="get">
        {hidden}
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={values.q} placeholder="Morada, freguesia, ref, contacto, próxima ação" className="pl-8" />
        </div>
        {selects}
        <Button type="submit" variant="secondary">Filtrar</Button>
        {chips.length ? (
          <Button asChild variant="ghost">
            <Link href={`/deals?view=${values.view}`}>Limpar</Link>
          </Button>
        ) : null}
      </form>

      {/* Telemóvel: pesquisa + botão de filtros */}
      <form className="flex gap-2 md:hidden" method="get">
        {hidden}
        {(["status", "municipality", "typology", "source", "owner", "process"] as const).map((k) => (values[k] && !(k === "status" && values[k] === "active") ? <input key={k} type="hidden" name={k} value={values[k]} /> : null))}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-3 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={values.q} placeholder="Pesquisar negócios" className="h-11 pl-8" />
        </div>
        <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="size-4" /> Filtros{activeCount ? ` (${activeCount})` : ""}
        </Button>
      </form>
      {chips.length ? (
        <div className="flex flex-wrap gap-1.5 md:hidden">
          {chips.map((c) => (
            <Link key={c.key} href={hrefWithout(values, c.key)} className="inline-flex h-8 items-center gap-1 rounded-full border bg-card px-3 text-xs">
              {c.label} <X className="size-3 text-muted-foreground" />
            </Link>
          ))}
          <Link href={`/deals?view=${values.view}`} className="inline-flex h-8 items-center px-2 text-xs text-muted-foreground underline">
            Limpar
          </Link>
        </div>
      ) : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Os negócios da lista e do Kanban ficam filtrados até limpares.</SheetDescription>
          </SheetHeader>
          <form className="flex flex-col gap-3 px-4 pb-6" method="get">
            {hidden}
            {values.q ? <input type="hidden" name="q" value={values.q} /> : null}
            <div className="grid gap-3 [&_select]:h-11 [&_select]:w-full">{selects}</div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="h-11 flex-1">Aplicar</Button>
              <Button asChild type="button" variant="outline" className="h-11">
                <Link href={`/deals?view=${values.view}`} onClick={() => setOpen(false)}>Limpar</Link>
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
