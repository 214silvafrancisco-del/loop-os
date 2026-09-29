import type { Metadata } from "next";
import { PageHeader } from "@/core/ui/page-header";
import { ComingSoon } from "@/core/ui/coming-soon";

export const metadata: Metadata = { title: "Imóveis" };

export default function PropertiesPage() {
  return (
    <>
      <PageHeader
        title="Imóveis"
        description="Um registo por imóvel, do lead à venda."
      />
      <ComingSoon step="Step 05" what="Lista de imóveis" />
    </>
  );
}
