import type { Metadata } from "next";
import { PageHeader } from "@/core/ui/page-header";
import { createContact } from "@/modules/contacts/actions";
import { ContactForm } from "@/modules/contacts/components/contact-form";

export const metadata: Metadata = { title: "Novo contacto" };

export default function NewContactPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo contacto" />
      <ContactForm action={createContact} cancelHref="/contacts" />
    </div>
  );
}
