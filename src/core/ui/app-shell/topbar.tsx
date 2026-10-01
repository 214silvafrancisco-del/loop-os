import Link from "next/link";
import { Plus } from "lucide-react";
import type { CurrentUser } from "@/core/auth/current-user";
import { Button } from "@/components/ui/button";
import { Brand } from "./brand";
import { TopbarSearch } from "./topbar-search";
import { UserMenu } from "./user-menu";

export function Topbar({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      {/* Em mobile a marca vive aqui, porque a sidebar está escondida. */}
      <div className="md:hidden">
        <Brand variant="page" className="px-0" />
      </div>

      <TopbarSearch />

      <Button asChild size="sm" className="h-10 gap-1 sm:h-8">
        <Link href="/deals/new" aria-label="Novo negócio">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo negócio</span>
        </Link>
      </Button>

      <UserMenu user={user} />
    </header>
  );
}
