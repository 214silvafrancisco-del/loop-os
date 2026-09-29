"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContactFormState } from "../actions";
import type { Contact } from "../schema";
import { CONTACT_ROLES, CONTACT_ROLE_LABEL } from "../validation";

type Props = {
  action: (prev: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  contact?: Contact | null;
  cancelHref: string;
};

function Field({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function ContactForm({ action, contact, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};
  const roles = new Set<string>(contact?.roles ?? []);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
          <Field id="kind" label="Tipo">
            <select
              id="kind"
              name="kind"
              defaultValue={contact?.kind ?? "person"}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="person">Pessoa</option>
              <option value="company">Empresa</option>
            </select>
          </Field>

          <Field id="name" label="Nome" error={errors.name}>
            <Input id="name" name="name" defaultValue={contact?.name ?? ""} required autoFocus />
          </Field>

          <div className="flex flex-col gap-2 md:col-span-2">
            <Label>Papéis</Label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {CONTACT_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <Checkbox name="roles" value={role} defaultChecked={roles.has(role)} />
                  {CONTACT_ROLE_LABEL[role]}
                </label>
              ))}
            </div>
            {errors.roles ? <p className="text-xs text-destructive">{errors.roles}</p> : null}
          </div>

          <Field id="companyName" label="Agência / Empresa" error={errors.companyName}>
            <Input id="companyName" name="companyName" defaultValue={contact?.companyName ?? ""} />
          </Field>

          <Field id="nif" label="NIF" error={errors.nif}>
            <Input id="nif" name="nif" inputMode="numeric" defaultValue={contact?.nif ?? ""} />
          </Field>

          <Field id="phone" label="Telefone" error={errors.phone}>
            <Input id="phone" name="phone" type="tel" defaultValue={contact?.phone ?? ""} />
          </Field>

          <Field id="email" label="Email" error={errors.email}>
            <Input id="email" name="email" type="email" defaultValue={contact?.email ?? ""} />
          </Field>

          <Field id="address" label="Morada" error={errors.address} className="md:col-span-2">
            <Input id="address" name="address" defaultValue={contact?.address ?? ""} />
          </Field>

          <Field id="iban" label="IBAN" error={errors.iban} className="md:col-span-2">
            <Input id="iban" name="iban" defaultValue={contact?.iban ?? ""} />
          </Field>

          <Field id="notes" label="Notas" error={errors.notes} className="md:col-span-2">
            <Textarea id="notes" name="notes" rows={3} defaultValue={contact?.notes ?? ""} />
          </Field>
        </CardContent>
      </Card>

      {state.error ? (
        <div className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-medium">{state.error}</p>
          {state.duplicates?.length ? (
            <>
              <p className="mt-1 text-muted-foreground">
                Existente: {state.duplicates.join(", ")}. Podes guardar na mesma.
              </p>
              <input type="hidden" name="confirmDuplicate" value="1" />
            </>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "A guardar…" : state.duplicates?.length ? "Guardar na mesma" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
