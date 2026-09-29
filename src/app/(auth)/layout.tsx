import { Brand } from "@/core/ui/app-shell/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <Brand variant="page" />
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-xs text-muted-foreground">Invest. Transform. Sell.</p>
    </div>
  );
}
