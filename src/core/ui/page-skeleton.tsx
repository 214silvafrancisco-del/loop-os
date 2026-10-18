import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Esqueleto neutro de uma página: título, descrição e três blocos. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-20" />
        ))}
      </div>
      <Bar className="h-40" />
      <Bar className="h-28" />
    </div>
  );
}

/** Esqueleto do conteúdo de um separador de ficha (o cabeçalho da ficha mantém-se). */
export function TabSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-3">
      <Bar className="h-5 w-40" />
      <Bar className="h-24" />
      <Bar className="h-24" />
    </div>
  );
}
