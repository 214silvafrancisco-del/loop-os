"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setDealStatus } from "../actions";

/** Excluir tira o negócio do pipeline; reativar repõe-no na mesma fase. */
export function DealStatusButton({ id, status }: { id: string; status: "active" | "excluded" }) {
  const [pending, startTransition] = useTransition();
  const excluded = status === "excluded";
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1"
      disabled={pending}
      onClick={() => startTransition(() => setDealStatus(id, excluded ? "active" : "excluded"))}
    >
      {excluded ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
      {pending ? "…" : excluded ? "Reativar" : "Excluir"}
    </Button>
  );
}
