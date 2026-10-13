import type { Metadata } from "next";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { PushSettings } from "@/modules/notifications/components/push-settings";
import { getPushStatus } from "@/modules/notifications/queries";

export const metadata: Metadata = { title: "Notificações" };

/** Ativação das notificações push, acessível a todos (as Definições são só do admin). */
export default async function NotificationsPage() {
  const user = await requireUser();
  const push = await getPushStatus(user.id);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notificações" description="Resumo diário das tuas tarefas e das faturas a vencer, no telemóvel ou no computador." />
      <PushSettings status={push} />
    </div>
  );
}
