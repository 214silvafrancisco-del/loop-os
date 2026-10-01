import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { CreateSaleButton } from "@/modules/sales/components/create-sale-button";
import { listSellableProperties } from "@/modules/sales/queries";

export const metadata: Metadata = { title: "Nova venda" };

/** Escolher um imóvel detido (sem venda ativa) para começar a vender. */
export default async function NewSalePage() {
  const user = await requireUser();
  const properties = await listSellableProperties(user.organizationId);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nova venda" description="Só imóveis comprados pela LOOP e ainda sem venda em curso. Também podes começar pelo botão «Colocar à venda» na ficha do negócio." />
      {properties.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Não há imóveis detidos sem venda em curso.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {properties.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="font-mono text-xs font-semibold text-muted-foreground">{p.ref}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{p.dealName ?? p.addressLine}</span>
                {p.dealName ? <span className="block text-xs text-muted-foreground">{p.addressLine}</span> : null}
              </span>
              <CreateSaleButton propertyId={p.id} dealId={p.dealId ?? undefined} existing={null} canCreate />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Button asChild variant="outline">
          <Link href="/sales">Voltar às vendas</Link>
        </Button>
      </div>
    </div>
  );
}
