import Link from "next/link";
import { Plus, Search, Settings } from "lucide-react";
import type { CurrentUser } from "@/core/auth/current-user";
import { Button } from "@/components/ui/button";
import { Brand } from "./brand";
import { UserMenu } from "./user-menu";

export function Topbar({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      {/* Em mobile a marca vive aqui, porque a sidebar está escondida. */}
      <div className="md:hidden">
        <Brand variant="page" className="px-0" />
      </div>

      <Button
        variant="outline"
        className="ml-auto hidden w-64 justify-start gap-2 text-muted-foreground sm:flex"
        disabled
      >
        <Search className="size-4" />
        Pesquisar…
        <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px]">⌘K</kbd>
      </Button>

      <Button asChild size="sm" className="gap-1">
        <Link href="/deals">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo negócio</span>
        </Link>
      </Button>

      <Button asChild variant="ghost" size="icon" className="md:hidden">
        <Link href="/settings" aria-label="Definições">
          <Settings className="size-4" />
        </Link>
      </Button>

      <UserMenu user={user} />
    </header>
  );
}
