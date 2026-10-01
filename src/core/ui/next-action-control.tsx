"use client";

import { CalendarClock, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDate } from "@/core/lib/format";

type Props = {
  action: string | null;
  date: string | null;
  onSave: (input: { nextAction: string; nextActionDate: string }) => Promise<unknown>;
  onDone: () => Promise<unknown>;
  compact?: boolean;
  className?: string;
};

function isOverdue(date: string | null) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(date + "T00:00:00").getTime() < today.getTime();
}

/** Próxima ação editável num popover, com botão «feito». Genérico: recebe as ações. */
export function NextActionControl({ action, date, onSave, onDone, compact, className }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const overdue = isOverdue(date);
  const empty = !action && !date;

  function save(formData: FormData) {
    startTransition(async () => {
      await onSave({ nextAction: String(formData.get("nextAction") ?? ""), nextActionDate: String(formData.get("nextActionDate") ?? "") });
      setOpen(false);
      router.refresh();
    });
  }

  function done() {
    startTransition(async () => {
      await onDone();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn("flex w-full items-start gap-1.5 rounded-md text-left text-xs hover:bg-accent", compact ? "px-1 py-0.5" : "px-2 py-1", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <CalendarClock className={cn("mt-0.5 size-3.5 shrink-0", overdue ? "text-destructive" : "text-muted-foreground")} />
        {empty ? (
          <span className="text-muted-foreground">Definir próxima ação</span>
        ) : (
          <span className="min-w-0">
            {action ? <span className="block truncate">{action}</span> : null}
            {date ? (
              <span className={cn(overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                {formatDate(date)}
                {overdue ? " · atrasada" : ""}
              </span>
            ) : null}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72" onClick={(e) => e.stopPropagation()}>
        <form action={save} className="flex flex-col gap-3">
          <Input name="nextAction" placeholder="O que fazer a seguir" defaultValue={action ?? ""} autoFocus />
          <Input name="nextActionDate" type="date" defaultValue={date ?? ""} />
          <div className="flex justify-between gap-2">
            {!empty ? (
              <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={done} disabled={pending}>
                <Check className="size-4" />
                Feito
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "…" : "Guardar"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
