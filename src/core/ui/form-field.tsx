import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + controlo + mensagem de erro, com grelha opcional. */
export function FormField({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Secção de formulário com título. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? (
        <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      ) : (
        <div className="mb-4" />
      )}
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

/** `<select>` nativo com o mesmo aspeto do Input do shadcn. */
export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.className,
      )}
    />
  );
}
