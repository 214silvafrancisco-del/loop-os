import type { Metadata } from "next";
import { PageHeader } from "@/core/ui/page-header";
import { ComingSoon } from "@/core/ui/coming-soon";

export const metadata: Metadata = { title: "Obras" };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Obras"
        description="Orçamento, autos de medição, faturas e pagamentos."
      />
      <ComingSoon step="Step 13" what="Lista de obras" />
    </>
  );
}
