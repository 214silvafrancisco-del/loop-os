import { AppShell } from "@/core/ui/app-shell/app-shell";

// Layout de todas as páginas autenticadas. No Step 03 passa a exigir sessão.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
