import type { Metadata } from "next";
import { PageHeader } from "@/core/ui/page-header";
import { ComingSoon } from "@/core/ui/coming-soon";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ações da semana, pipeline, obras em curso e faturas por pagar."
      />
      <ComingSoon step="Step 07" what="Dashboard com KPIs e ações da semana" />
    </>
  );
}
