import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/core/lib/format";
import { ChecklistMini } from "@/modules/checklists/components/checklist-mini";
import type { ChecklistProgress } from "@/modules/checklists/queries";
import { PropertyRef } from "@/modules/properties/components/property-badges";
import type { ProjectRow } from "../queries";
import { ProjectStatusBadge } from "./project-badges";
import { ProjectCard } from "./project-card";

export function ProjectsTable({ projects, progress }: { projects: ProjectRow[]; progress?: Map<string, ChecklistProgress> }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Sem obras. Uma obra cria-se a partir de um negócio comprado, no botão “Criar obra”.
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} progress={progress?.get(p.id)} />
        ))}
      </div>
      <div className="hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Ref</TableHead>
            <TableHead>Obra</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">Procedimento</TableHead>
            <TableHead className="hidden md:table-cell">Início</TableHead>
            <TableHead className="hidden md:table-cell">Conclusão</TableHead>
            <TableHead className="hidden lg:table-cell text-right">Compra</TableHead>
            <TableHead className="hidden lg:table-cell">Responsável</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell><PropertyRef value={p.ref} /></TableCell>
              <TableCell>
                <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                <div className="text-xs text-muted-foreground">
                  {p.addressLine}{p.parish ? ` · ${p.parish}` : ""}{p.typology ? ` · ${p.typology}` : ""}
                </div>
              </TableCell>
              <TableCell><ProjectStatusBadge status={p.status} /></TableCell>
              <TableCell className="hidden md:table-cell">
                <ChecklistMini done={progress?.get(p.id)?.done ?? null} total={progress?.get(p.id)?.total ?? null} href={`/projects/${p.id}/processo`} />
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {p.actualStart ? formatDate(p.actualStart) : p.plannedStart ? <span title="previsto">{formatDate(p.plannedStart)} <span className="text-xs">prev.</span></span> : "—"}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {p.actualEnd ? formatDate(p.actualEnd) : p.plannedEnd ? <span title="previsto">{formatDate(p.plannedEnd)} <span className="text-xs">prev.</span></span> : "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-right tabular-nums">{formatCurrency(p.finalPrice)}</TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">{p.managerName ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </>
  );
}
