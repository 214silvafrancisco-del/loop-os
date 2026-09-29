import { redirect } from "next/navigation";

export default async function DealIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/deals/${id}/resumo`);
}
