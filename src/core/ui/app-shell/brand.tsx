import { Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Marca. `sidebar` usa as cores da sidebar escura; `page` as cores normais
 * (páginas de login, etc.). Quando o logótipo em SVG estiver disponível em
 * public/brand/, substitui-se o ícone e o texto pelo ficheiro.
 */
export function Brand({
  className,
  variant = "sidebar",
}: {
  className?: string;
  variant?: "sidebar" | "page";
}) {
  const onSidebar = variant === "sidebar";
  return (
    <Link
      href="/dashboard"
      className={cn("flex items-center gap-2 px-2 py-1", className)}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-lg",
          onSidebar
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        <Home className="size-4" strokeWidth={2.5} />
      </span>
      <span
        className={cn(
          "font-heading text-lg font-semibold tracking-tight",
          onSidebar ? "text-sidebar-foreground" : "text-foreground",
        )}
      >
        Loop
        <span className={onSidebar ? "text-sidebar-primary" : "text-primary"}>.</span>
      </span>
    </Link>
  );
}
