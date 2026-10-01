import { ListChecks, LogOut, Settings, Users } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/core/auth/actions";
import type { CurrentUser } from "@/core/auth/current-user";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  admin: "Administrador",
  manager: "Gestor",
  user: "Utilizador",
};

export function UserMenu({ user }: { user: CurrentUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Menu do utilizador"
      >
        <Avatar className="size-11 sm:size-8">
          <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary sm:text-xs">
            {user.initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{user.fullName}</span>
          <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
          <span className="text-xs font-normal text-muted-foreground">{ROLE_LABEL[user.role]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="md:hidden">
          <Link href="/contacts" className="min-h-10">
            <Users className="size-4" />
            Contactos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="min-h-10">
            <Settings className="size-4" />
            Definições
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/procedimentos" className="min-h-10">
            <ListChecks className="size-4" />
            Procedimentos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="min-h-10 w-full">
              <LogOut className="size-4" />
              Terminar sessão
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
