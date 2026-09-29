import { Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Marca na sidebar. Quando o logótipo em SVG estiver disponível em
 * public/brand/, substitui-se o ícone e o texto pelo ficheiro.
 */
export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex items-center gap-2 px-2 py-1", className)}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Home className="size-4" strokeWidth={2.5} />
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight text-sidebar-foreground">
        Loop<span className="text-sidebar-primary">.</span>
      </span>
    </Link>
  );
}
