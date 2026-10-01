"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/core/navigation";

/** Barra inferior em ecrãs pequenos (< md). */
export function MobileNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => i.mobile).slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", active && "bg-primary/12")}>
              <Icon className="size-6" strokeWidth={active ? 2.25 : 2} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
