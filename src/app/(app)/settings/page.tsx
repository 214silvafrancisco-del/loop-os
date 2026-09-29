import type { Metadata } from "next";
import { PageHeader } from "@/core/ui/page-header";
import { ComingSoon } from "@/core/ui/coming-soon";

export const metadata: Metadata = { title: "Definições" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Definições"
        description="Utilizadores, fases, fontes, categorias e tabelas de IMT."
      />
      <ComingSoon step="Step 03" what="Utilizadores e listas configuráveis" />
    </>
  );
}
