import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Contact } from "../schema";
import { CONTACT_KIND_LABEL, CONTACT_ROLE_LABEL } from "../validation";

export function RoleBadges({ roles }: { roles: Contact["roles"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r} variant="secondary" className="font-normal">
          {CONTACT_ROLE_LABEL[r]}
        </Badge>
      ))}
    </div>
  );
}

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Sem contactos para mostrar.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="hidden md:table-cell">Papéis</TableHead>
            <TableHead className="hidden lg:table-cell">Agência / Empresa</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="hidden lg:table-cell">NIF</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
                <div className="text-xs text-muted-foreground md:hidden">
                  {c.roles.map((r) => CONTACT_ROLE_LABEL[r]).join(", ")}
                </div>
                {c.kind === "company" ? (
                  <div className="text-xs text-muted-foreground">{CONTACT_KIND_LABEL.company}</div>
                ) : null}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <RoleBadges roles={c.roles} />
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {c.companyName ?? ""}
              </TableCell>
              <TableCell>
                {c.phone ? (
                  <a href={`tel:${c.phoneNormalized ?? c.phone}`} className="hover:underline">
                    {c.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {c.email ?? ""}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {c.nif ?? ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
