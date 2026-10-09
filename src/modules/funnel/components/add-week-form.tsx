"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveFunnelWeek } from "../actions";
import { weekStartOf } from "../weeks";

/** Acrescenta uma semana anterior ao histórico (qualquer dia da semana serve). */
export function AddWeekForm({ existing }: { existing: string[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function add() {
    setError(null);
    if (!date) return setError("Escolhe uma data.");
    const ws = weekStartOf(date);
    if (existing.includes(ws)) return setError("Essa semana já está na lista.");
    startTransition(async () => {
      const r = await saveFunnelWeek({ weekStart: ws, leads: "", visits: "", proposals: "", purchases: "" });
      if (!r.ok) return setError(r.error);
      setDate("");
      router.refresh();
    });
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-auto md:h-8" aria-label="Data de uma semana anterior" />
      <Button type="button" size="sm" variant="outline" className="h-10 gap-1 md:h-8" onClick={add} disabled={pending}>
        <Plus className="size-4" /> Acrescentar semana
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
