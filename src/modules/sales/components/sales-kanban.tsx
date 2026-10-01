"use client";

import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/core/lib/format";
import { NativeSelect } from "@/core/ui/form-field";
import { changeSaleStage } from "../actions";
import { SALE_STAGES } from "../constants";
import type { SaleListRow } from "../queries";
import type { SaleStage } from "../schema";
import { CloseSaleDialog } from "./close-sale-dialog";
import { SaleCardBody } from "./sale-card";

/** Colunas do Kanban: só as fases abertas; vendidas e canceladas ficam na lista. */
const BOARD_STAGES = SALE_STAGES.filter((s) => !s.closed);

function Card({ sale }: { sale: SaleListRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sale.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={cn("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")} {...listeners} {...attributes}>
      <SaleCardBody sale={sale} />
    </div>
  );
}

function Column({ stage, sales, active }: { stage: (typeof SALE_STAGES)[number]; sales: SaleListRow[]; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
  const total = sales.reduce((acc, s) => acc + Number(s.listingPrice ?? 0), 0);
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors", isOver && active && "border-primary bg-primary/5")}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-semibold">{stage.label}</span>
        <span className="rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">{sales.length}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{total ? formatCurrency(total) : ""}</span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {sales.map((s) => (
          <Card key={s.id} sale={s} />
        ))}
      </div>
    </div>
  );
}

export function SalesKanban({ sales: initial }: { sales: SaleListRow[] }) {
  const router = useRouter();
  const [seen, setSeen] = useState(initial);
  const [sales, setSales] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setSales(initial);
  }
  const [activeId, setActiveId] = useState<string | null>(null);
  const [closing, setClosing] = useState<SaleListRow | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  function moveLocally(id: string, stage: SaleStage) {
    setSales((prev) => prev.map((s) => (s.id === id ? { ...s, stage } : s)));
  }

  function commit(sale: SaleListRow, stage: SaleStage, close?: { salePrice: string; deedDate: string }) {
    const previous = sale.stage;
    moveLocally(sale.id, stage);
    startTransition(async () => {
      const r = await changeSaleStage(sale.id, stage, close);
      if (r.ok) {
        setClosing(null);
        router.refresh();
        return;
      }
      moveLocally(sale.id, previous);
      if ("needsClose" in r) setClosing(sale);
      else alert(r.error);
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const sale = sales.find((s) => s.id === String(e.active.id));
    const stage = e.over ? (String(e.over.id) as SaleStage) : null;
    if (!sale || !stage || stage === sale.stage) return;
    commit(sale, stage);
  }
  const active = activeId ? sales.find((s) => s.id === activeId) : null;

  return (
    <>
      <div className="flex flex-col gap-4 md:hidden">
        {BOARD_STAGES.map((st) => {
          const list = sales.filter((s) => s.stage === st.value);
          return (
            <section key={st.value}>
              <header className="mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: st.color }} />
                <span className="text-sm font-semibold">{st.label}</span>
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </header>
              {list.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">Sem vendas nesta fase.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {list.map((s) => (
                    <div key={s.id} className="flex flex-col gap-1.5">
                      <SaleCardBody sale={s} />
                      <NativeSelect aria-label={`Mover ${s.ref} para outra fase`} value={s.stage} onChange={(e) => commit(s, e.target.value as SaleStage)} className="h-10 text-sm">
                        {SALE_STAGES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.value === s.stage ? `Fase: ${o.label}` : `Mover para ${o.label}`}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="hidden gap-3 overflow-x-auto pb-3 md:flex">
          {BOARD_STAGES.map((st) => (
            <Column key={st.value} stage={st} sales={sales.filter((s) => s.stage === st.value)} active={Boolean(activeId)} />
          ))}
        </div>
        <DragOverlay>{active ? <div className="w-72"><SaleCardBody sale={active} dragging /></div> : null}</DragOverlay>
      </DndContext>

      {closing ? (
        <CloseSaleDialog
          open
          label={`${closing.ref} · ${closing.dealName ?? closing.addressLine}`}
          salePrice={closing.salePrice ?? closing.listingPrice}
          deedDate={closing.deedDate}
          onCancel={() => setClosing(null)}
          onConfirm={async (input) => {
            const r = await changeSaleStage(closing.id, "vendido", input);
            if (r.ok) {
              setClosing(null);
              router.refresh();
              return null;
            }
            return r.error;
          }}
        />
      ) : null}
    </>
  );
}
