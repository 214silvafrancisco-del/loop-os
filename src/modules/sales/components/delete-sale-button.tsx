"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteSale } from "../actions";

export function DeleteSaleButton({ saleId }: { saleId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1 text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("Apagar esta venda? As mediadoras e os leads registados são apagados; o imóvel volta a Detido.")) return;
        startTransition(async () => {
          const r = await deleteSale(saleId);
          if (r && !r.ok) alert(r.error);
        });
      }}
    >
      <Trash2 className="size-4" />
      Apagar
    </Button>
  );
}
