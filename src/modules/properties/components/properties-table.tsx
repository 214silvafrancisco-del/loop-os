import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatArea, formatCurrency } from "@/core/lib/format";
import type { Property } from "../schema";
import { PROPERTY_TYPE_LABEL } from "../validation";
import { PropertyRef, PropertyStatusBadge } from "./property-badges";

export function PropertiesTable({ properties }: { properties: Property[] }) {
  if (properties.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Sem imóveis para mostrar.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Ref</TableHead>
            <TableHead>Morada</TableHead>
            <TableHead className="hidden md:table-cell">Freguesia</TableHead>
            <TableHead className="hidden lg:table-cell">Tipo</TableHead>
            <TableHead>Tipologia</TableHead>
            <TableHead className="hidden md:table-cell text-right">Área</TableHead>
            <TableHead className="hidden lg:table-cell text-right">VPT</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <PropertyRef value={p.ref} />
              </TableCell>
              <TableCell>
                <Link href={`/properties/${p.id}`} className="font-medium hover:underline">
                  {p.name ?? p.addressLine}
                </Link>
                {p.name ? <div className="text-xs text-muted-foreground">{p.addressLine}</div> : null}
                <div className="text-xs text-muted-foreground md:hidden">{p.parish ?? p.municipality ?? ""}</div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {p.parish ?? ""}
                {p.municipality && p.municipality !== p.parish ? (
                  <span className="text-xs"> · {p.municipality}</span>
                ) : null}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {PROPERTY_TYPE_LABEL[p.propertyType]}
              </TableCell>
              <TableCell>{p.typology ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="hidden md:table-cell text-right tabular-nums">{formatArea(p.grossArea)}</TableCell>
              <TableCell className="hidden lg:table-cell text-right tabular-nums">{formatCurrency(p.vpt)}</TableCell>
              <TableCell>
                <PropertyStatusBadge status={p.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
