"use client";

import { Tag } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createSale } from "../actions";
import { SALE_STAGE_LABEL } from "../constants";
import type { SaleStage } from "../schema";

type Props = {
  dealId?: string;
  propertyId?: string;
  /** Venda já existente: mostra link em vez de criar. */
  existing: { id: string; stage: SaleStage } | null;
  canCreate: boolean;
};

/** «Colocar à venda» no negócio comprado ou no imóvel detido. */
export function CreateSaleButton({ dealId, propertyId, existing, canCreate }: Props) {
  const [pending, startTransition] = useTransition();
  if (existing) {
    return (
      <Button asChild size="sm" variant="outline" className="gap-1">
        <Link href={`/sales/${existing.id}`}>
          <Tag className="size-4" />
          Venda · {SALE_STAGE_LABEL[existing.stage]}
        </Link>
      </Button>
    );
  }
  if (!canCreate) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await createSale({ dealId, propertyId });
          if (r && !r.ok) alert(r.error);
        })
      }
    >
      <Tag className="size-4" />
      {pending ? "A criar…" : "Colocar à venda"}
    </Button>
  );
}
