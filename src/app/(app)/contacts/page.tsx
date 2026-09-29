import type { Metadata } from "next";
import { PageHeader } from "@/core/ui/page-header";
import { ComingSoon } from "@/core/ui/coming-soon";

export const metadata: Metadata = { title: "Contactos" };

export default function ContactsPage() {
  return (
    <>
      <PageHeader
        title="Contactos"
        description="Consultores, proprietários, fornecedores e bancos."
      />
      <ComingSoon step="Step 04" what="Lista de contactos" />
    </>
  );
}
