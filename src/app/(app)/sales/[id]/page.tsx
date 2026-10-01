import { redirect } from "next/navigation";

export default async function SaleIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/sales/${id}/resumo`);
}
