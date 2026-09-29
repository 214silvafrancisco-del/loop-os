import type { Metadata } from "next";
import { PageHeader } from "@/core/ui/page-header";
import { ComingSoon } from "@/core/ui/coming-soon";

export const metadata: Metadata = { title: "Negócios" };

export default function DealsPage() {
  return (
    <>
      <PageHeader
        title="Negócios"
        description="Pipeline de aquisição: Lead Fria → Lead Morna → Visita → Proposta → Compra."
      />
      <ComingSoon step="Step 06" what="Lista e Kanban de negócios" />
    </>
  );
}
