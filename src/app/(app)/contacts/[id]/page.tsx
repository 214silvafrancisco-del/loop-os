import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { updateContact } from "@/modules/contacts/actions";
import { ContactForm } from "@/modules/contacts/components/contact-form";
import { RoleBadges } from "@/modules/contacts/components/contacts-table";
import { DeleteContactButton } from "@/modules/contacts/components/delete-contact-button";
import { getContact } from "@/modules/contacts/queries";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requireUser();
  const contact = await getContact(user.organizationId, (await params).id);
  return { title: contact?.name ?? "Contacto" };
}

export default async function ContactPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const contact = await getContact(user.organizationId, id);
  if (!contact) notFound();

  const canDelete = user.role !== "user";
  const update = updateContact.bind(null, contact.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={contact.name}
        description={contact.companyName ?? undefined}
        actions={canDelete ? <DeleteContactButton id={contact.id} name={contact.name} /> : null}
      />
      <div className="mb-4">
        <RoleBadges roles={contact.roles} />
      </div>
      <ContactForm action={update} contact={contact} cancelHref="/contacts" />
    </div>
  );
}
