"use client";

import { Pin, PinOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addDealNote, deleteDealNote, toggleNotePinned, type NoteFormState } from "../notes-actions";
import type { DealNoteRow } from "../notes-queries";

const when = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" });

type Props = { dealId: string; notes: DealNoteRow[]; currentUserId: string; canModerate: boolean };

export function NotesPanel({ dealId, notes, currentUserId, canModerate }: Props) {
  const router = useRouter();
  const add = addDealNote.bind(null, dealId);
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(add, {});
  const [, startTransition] = useTransition();

  function pin(id: string) {
    startTransition(async () => {
      await toggleNotePinned(id, dealId);
      router.refresh();
    });
  }
  function remove(id: string) {
    if (!confirm("Apagar esta nota?")) return;
    startTransition(async () => {
      await deleteDealNote(id, dealId);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <Textarea
          name="body"
          rows={3}
          placeholder="Escreve uma nota: o que disse o proprietário, o que viste na visita, dúvidas…"
          defaultValue={state.body ?? ""}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{state.error ?? "Ctrl+Enter para guardar"}</span>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "A guardar…" : "Adicionar nota"}
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Ainda sem notas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => {
            const mine = n.createdBy === currentUserId;
            return (
              <li key={n.id} className={cn("rounded-xl border bg-card p-4", n.isPinned && "border-primary/50 bg-primary/5")}>
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  {n.isPinned ? <Pin className="size-3.5 text-primary" /> : null}
                  <span className="font-medium text-foreground">{n.authorName ?? "—"}</span>
                  <span>{when.format(n.createdAt)}</span>
                  <span className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" className="size-7" title={n.isPinned ? "Desafixar" : "Fixar no topo"} onClick={() => pin(n.id)}>
                      {n.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                    </Button>
                    {mine || canModerate ? (
                      <Button variant="ghost" size="icon" className="size-7 text-destructive" title="Apagar" onClick={() => remove(n.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
