import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/current-user";
import { AppShell } from "@/core/ui/app-shell/app-shell";
import { ServiceWorkerRegistrar } from "@/modules/notifications/components/sw-register";

// Layout de todas as páginas autenticadas. O proxy já redireciona quem não
// tem sessão; esta verificação cobre perfis desativados e é a fonte do
// utilizador para a shell.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AppShell user={user}>
      <ServiceWorkerRegistrar />
      {children}
    </AppShell>
  );
}
