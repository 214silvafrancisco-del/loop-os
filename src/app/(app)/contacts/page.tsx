import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactsTable } from "@/modules/contacts/components/contacts-table";
import { listContacts } from "@/modules/contacts/queries";
import type { ContactRole } from "@/modules/contacts/schema";
import { CONTACT_ROLES, CONTACT_ROLE_LABEL } from "@/modules/contacts/validation";

export const metadata: Metadata = { title: "Contactos" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const user = await requireUser();
  const { q, role } = await searchParams;
  const roleFilter = (CONTACT_ROLES as readonly string[]).includes(role ?? "")
    ? (role as ContactRole)
    : undefined;

  const contacts = await listContacts(user.organizationId, { q, role: roleFilter });

  return (
    <>
      <PageHeader
        title="Contactos"
        description="Consultores, proprietários, fornecedores e bancos."
        actions={
          <Button asChild size="sm" className="gap-1">
            <Link href="/contacts/new">
              <Plus className="size-4" />
              Novo contacto
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <div className="relative flex-1 min-w-56">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nome, empresa, telefone, email ou NIF"
            className="pl-8"
          />
        </div>
        <select
          name="role"
          defaultValue={roleFilter ?? ""}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Todos os papéis</option>
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {CONTACT_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {q || roleFilter ? (
          <Button asChild variant="ghost">
            <Link href="/contacts">Limpar</Link>
          </Button>
        ) : null}
      </form>

      <p className="mb-2 text-xs text-muted-foreground">
        {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"}
      </p>
      <ContactsTable contacts={contacts} />
    </>
  );
}
