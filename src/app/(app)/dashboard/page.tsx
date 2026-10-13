import type { Metadata } from "next";
import { requireUser } from "@/core/auth/current-user";
import { formatDate } from "@/core/lib/format";
import { PageHeader } from "@/core/ui/page-header";
import { CollaboratorSelect } from "@/modules/dashboard/components/collaborator-select";
import { addDays, FounderDashboard, startOfWeek } from "@/modules/dashboard/components/founder-dashboard";
import { PersonalDashboard } from "@/modules/dashboard/components/personal-dashboard";
import { todayIso } from "@/modules/deals/utils";
import { listUsers } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Dashboard (Fase 4). Colaboradores: dashboard pessoal (só o que os acessos permitem).
 * Admin (Founder): visão global de gestão ou, com `?u=<id>`, a visão consolidada de um colaborador.
 * O parâmetro `u` é ignorado para quem não é admin: ninguém vê o dashboard de outra pessoa.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const user = await requireUser();
  const { u } = await searchParams;
  const today = todayIso();
  const weekStart = startOfWeek(today);
  const week = `Semana de ${formatDate(weekStart)} a ${formatDate(addDays(weekStart, 6))}.`;
  const first = user.fullName.split(" ")[0] ?? user.fullName;

  if (user.role !== "admin") {
    return (
      <>
        <PageHeader title={`Olá, ${first}`} description={week} />
        <PersonalDashboard viewer={user} subject={{ id: user.id, fullName: user.fullName }} today={today} isSelf />
      </>
    );
  }

  const users = await listUsers(user.organizationId, { includeInactive: true });
  const subject = u ? (users.find((x) => x.id === u) ?? null) : null;
  return (
    <>
      <PageHeader
        title={subject ? (subject.id === user.id ? `Olá, ${first}` : subject.fullName) : "Dashboard"}
        description={subject && subject.id !== user.id ? `Visão por colaborador · ${week}` : week}
        actions={<CollaboratorSelect users={users} value={subject?.id ?? ""} selfId={user.id} />}
      />
      {subject ? <PersonalDashboard viewer={user} subject={subject} today={today} isSelf={subject.id === user.id} /> : <FounderDashboard user={user} today={today} />}
    </>
  );
}
