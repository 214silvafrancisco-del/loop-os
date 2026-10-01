"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/core/lib/format";
import { NativeSelect } from "@/core/ui/form-field";
import type { DealStage } from "@/modules/settings/queries";
import { confirmMissing } from "@/modules/checklists/components/gate-confirm";
import { changeDealStage, type PurchaseInput } from "../actions";
import type { DealListRow } from "../queries";
import { dealRef } from "../utils";
import { KanbanCard, KanbanCardBody } from "./kanban-card";
import { PurchaseDialog } from "./purchase-dialog";

type Props = { stages: DealStage[]; deals: DealListRow[] };

function Column({ stage, deals, active }: { stage: DealStage; deals: DealListRow[]; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((acc, d) => acc + Number(d.askingPrice ?? 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
        isOver && active && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: stage.color ?? "currentColor" }} />
        <span className="text-sm font-semibold">{stage.name}</span>
        <span className="rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">{deals.length}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{total ? formatCurrency(total) : ""}</span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {deals.map((d) => (
          <KanbanCard key={d.id} deal={d} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({ stages, deals: initialDeals }: Props) {
  const router = useRouter();
  // Dados novos do servidor (router.refresh) substituem o estado local sem efeito:
  // guardamos a última prop vista e reiniciamos o estado quando muda.
  const [seenDeals, setSeenDeals] = useState(initialDeals);
  const [deals, setDeals] = useState(initialDeals);
  if (seenDeals !== initialDeals) {
    setSeenDeals(initialDeals);
    setDeals(initialDeals);
  }
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<{ deal: DealListRow; stageId: string } | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  function moveLocally(dealId: string, stageId: string) {
    const stage = stages.find((s) => s.id === stageId);
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, stageId, stageName: stage?.name ?? d.stageName, stageColor: stage?.color ?? d.stageColor, stageIsPurchase: stage?.isPurchase ?? false }
          : d,
      ),
    );
  }

  function commit(deal: DealListRow, stageId: string, purchase?: PurchaseInput) {
    const previousStage = deal.stageId;
    moveLocally(deal.id, stageId);
    startTransition(async () => {
      let result = await changeDealStage(deal.id, stageId, purchase);
      if (!result.ok && "needsConfirm" in result) {
        if (confirmMissing(result.missing, "mudar a fase")) result = await changeDealStage(deal.id, stageId, purchase, { force: true });
      }
      if (result.ok) {
        setPendingPurchase(null);
        router.refresh();
        return;
      }
      moveLocally(deal.id, previousStage);
      if ("needsPurchase" in result) setPendingPurchase({ deal, stageId });
      else if ("error" in result) alert(result.error);
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const dealId = String(e.active.id);
    const stageId = e.over ? String(e.over.id) : null;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || !stageId || stageId === deal.stageId) return;
    commit(deal, stageId);
  }

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  return (
    <>
      {/* Telemóvel: lista por fase; mover com um seletor em vez de arrastar. */}
      <div className="flex flex-col gap-4 md:hidden">
        {stages.map((s) => {
          const list = deals.filter((d) => d.stageId === s.id);
          const total = list.reduce((acc, d) => acc + Number(d.askingPrice ?? 0), 0);
          return (
            <section key={s.id}>
              <header className="mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color ?? "currentColor" }} />
                <span className="text-sm font-semibold">{s.name}</span>
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{list.length}</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{total ? formatCurrency(total) : ""}</span>
              </header>
              {list.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">Sem negócios nesta fase.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {list.map((d) => (
                    <div key={d.id} className="flex flex-col gap-1.5">
                      <KanbanCardBody deal={d} />
                      <NativeSelect
                        aria-label={`Mover ${d.name ?? d.addressLine} para outra fase`}
                        value={d.stageId}
                        onChange={(e) => commit(d, e.target.value)}
                        className="h-10 text-sm"
                      >
                        {stages.map((st) => (
                          <option key={st.id} value={st.id}>{st.id === d.stageId ? `Fase: ${st.name}` : `Mover para ${st.name}`}</option>
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
          {stages.map((s) => (
            <Column key={s.id} stage={s} deals={deals.filter((d) => d.stageId === s.id)} active={activeId !== null} />
          ))}
        </div>
        <DragOverlay>{activeDeal ? <div className="w-72"><KanbanCardBody deal={activeDeal} dragging /></div> : null}</DragOverlay>
      </DndContext>

      {pendingPurchase ? (
        <PurchaseDialog
          open
          dealLabel={`${dealRef(pendingPurchase.deal)} · ${pendingPurchase.deal.name ?? pendingPurchase.deal.addressLine}`}
          askingPrice={pendingPurchase.deal.askingPrice}
          onCancel={() => setPendingPurchase(null)}
          onConfirm={async (input) => {
            let result = await changeDealStage(pendingPurchase.deal.id, pendingPurchase.stageId, input);
            if (!result.ok && "needsConfirm" in result) {
              if (!confirmMissing(result.missing, "marcar como comprado")) return "Mudança de fase cancelada.";
              result = await changeDealStage(pendingPurchase.deal.id, pendingPurchase.stageId, input, { force: true });
            }
            if (result.ok) {
              setPendingPurchase(null);
              router.refresh();
              return null;
            }
            return "error" in result ? result.error : "Falta o valor final ou a data da escritura.";
          }}
        />
      ) : null}
    </>
  );
}
