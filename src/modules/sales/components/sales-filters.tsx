import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/core/ui/form-field";
import { SALE_STAGES } from "../constants";

type Props = {
  values: { q: string; stage: string; scope: string; owner: string; view: string };
  users: { value: string; label: string }[];
};

/** Filtros da lista de vendas (GET). */
export function SalesFilters({ values, users }: Props) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
      <input type="hidden" name="view" value={values.view} />
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={values.q} placeholder="Pesquisar por referência, morada ou nome" className="h-10 pl-8 md:h-9" />
      </div>
      {values.view === "list" ? (
        <>
          <NativeSelect name="stage" defaultValue={values.stage} className="h-10 w-auto md:h-9" aria-label="Fase">
            <option value="">Todas as fases</option>
            {SALE_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="scope" defaultValue={values.scope || "open"} className="h-10 w-auto md:h-9" aria-label="Âmbito">
            <option value="open">Em curso</option>
            <option value="closed">Vendidas e canceladas</option>
            <option value="all">Todas</option>
          </NativeSelect>
        </>
      ) : null}
      <NativeSelect name="owner" defaultValue={values.owner} className="h-10 w-auto md:h-9" aria-label="Responsável">
        <option value="">Responsável</option>
        {users.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </NativeSelect>
      <button type="submit" className="h-10 rounded-md border bg-card px-3 text-sm hover:bg-accent md:h-9">
        Filtrar
      </button>
    </form>
  );
}
