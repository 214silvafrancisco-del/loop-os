"use client";

import { HardHat } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createProjectFromDeal } from "../actions";

type Props = {
  dealId: string;
  /** Obra já existente: mostra link em vez de criar. */
  existing: { id: string; name: string } | null;
  /** Fase de compra com escritura. */
  canCreate: boolean;
};

export function CreateProjectButton({ dealId, existing, canCreate }: Props) {
  const [pending, startTransition] = useTransition();
  if (existing) {
    return (
      <Button asChild size="sm" variant="outline" className="gap-1">
        <Link href={`/projects/${existing.id}`}>
          <HardHat className="size-4" />
          Ver obra
        </Link>
      </Button>
    );
  }
  if (!canCreate) return null;
  return (
    <Button
      size="sm"
      className="gap-1"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await createProjectFromDeal(dealId);
          if (r && !r.ok) alert(r.error);
        })
      }
    >
      <HardHat className="size-4" />
      {pending ? "A criar…" : "Criar obra"}
    </Button>
  );
}
