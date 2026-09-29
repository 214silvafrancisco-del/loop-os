"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection, NativeSelect } from "@/core/ui/form-field";
import type { Contact } from "@/modules/contacts/schema";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABEL, TYPOLOGIES } from "@/modules/properties/validation";
import type { DealStage, SourceChannel, UserOption } from "@/modules/settings/queries";
import type { DealFormState } from "../actions";
import type { DealCreateInput } from "../validation";

type Props = {
  action: (prev: DealFormState, formData: FormData) => Promise<DealFormState>;
  stages: DealStage[];
  sources: SourceChannel[];
  users: UserOption[];
  contacts: Pick<Contact, "id" | "name" | "companyName" | "phone">[];
  currentUserId: string;
  parishes?: { parish: string; municipality: string | null }[];
  municipalities?: string[];
};

export function DealCreateForm({ action, stages, sources, users, contacts, currentUserId, parishes = [], municipalities = [] }: Props) {
  const [state, formAction, pending] = useActionState<DealFormState, FormData>(action, {});
  const [newContact, setNewContact] = useState(false);
  const errors = state.fieldErrors ?? {};
  const v = (state.values ?? {}) as Partial<DealCreateInput>;
  const g = (key: keyof DealCreateInput, fallback = "") => v[key] ?? fallback;
  const defaultStage = stages.find((s) => s.isDefault) ?? stages[0];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.duplicates?.length ? (
        <div className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-medium">{state.error}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {state.duplicates.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input type="radio" name="existingPropertyId" value={p.id} className="accent-primary" defaultChecked={state.duplicates!.length === 1} />
                <span>
                  Usar <span className="font-mono text-xs font-semibold">{p.ref}</span> · {p.addressLine}
                  {p.parish ? `, ${p.parish}` : ""}
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input type="radio" name="existingPropertyId" value="" className="accent-primary" />
              <span>Criar um imóvel novo com esta morada</span>
            </label>
          </div>
          <input type="hidden" name="confirmDuplicate" value="1" />
        </div>
      ) : null}

      <FormSection title="Imóvel" description="O essencial para identificar o imóvel. O resto preenche-se depois na ficha.">
        <FormField id="addressLine" label="Morada" error={errors.addressLine} className="md:col-span-2">
          <Input id="addressLine" name="addressLine" defaultValue={g("addressLine")} required autoFocus />
        </FormField>
        <FormField id="parish" label="Freguesia" error={errors.parish}>
          <Input id="parish" name="parish" list="parish-options" defaultValue={g("parish")} />
          <datalist id="parish-options">
            {parishes.map((x) => (
              <option key={x.parish} value={x.parish}>{x.municipality ?? ""}</option>
            ))}
          </datalist>
        </FormField>
        <FormField id="municipality" label="Concelho" error={errors.municipality}>
          <Input id="municipality" name="municipality" list="municipality-options" defaultValue={g("municipality")} />
          <datalist id="municipality-options">
            {municipalities.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </FormField>
        <FormField id="postalCode" label="Código postal" error={errors.postalCode}>
          <Input id="postalCode" name="postalCode" placeholder="0000-000" defaultValue={g("postalCode")} />
        </FormField>
        <FormField id="propertyType" label="Tipo de imóvel" error={errors.propertyType}>
          <NativeSelect id="propertyType" name="propertyType" defaultValue={g("propertyType", "apartamento")}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="typology" label="Tipologia" error={errors.typology}>
          <Input id="typology" name="typology" list="typology-options" placeholder="T2" defaultValue={g("typology")} />
          <datalist id="typology-options">
            {TYPOLOGIES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </FormField>
        <FormField id="floor" label="Piso" error={errors.floor} hint="RC, CV, 1, 2… ou Prédio">
          <Input id="floor" name="floor" defaultValue={g("floor")} />
        </FormField>
        <FormField id="grossArea" label="Área bruta (m²)" error={errors.grossArea}>
          <Input id="grossArea" name="grossArea" inputMode="decimal" defaultValue={g("grossArea")} />
        </FormField>
      </FormSection>

      <FormSection title="Negócio">
        <FormField id="askingPrice" label="Preço pedido (€)" error={errors.askingPrice}>
          <Input id="askingPrice" name="askingPrice" inputMode="decimal" defaultValue={g("askingPrice")} />
        </FormField>
        <FormField id="stageId" label="Fase" error={errors.stageId}>
          <NativeSelect id="stageId" name="stageId" defaultValue={g("stageId", defaultStage?.id ?? "")}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="ownerUserId" label="Responsável" error={errors.ownerUserId}>
          <NativeSelect id="ownerUserId" name="ownerUserId" defaultValue={g("ownerUserId", currentUserId)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="enteredAt" label="Data de entrada" error={errors.enteredAt}>
          <Input id="enteredAt" name="enteredAt" type="date" defaultValue={g("enteredAt", today)} />
        </FormField>
        <FormField id="name" label="Nome do negócio (opcional)" error={errors.name} hint="Por defeito: tipologia + freguesia." className="md:col-span-2">
          <Input id="name" name="name" defaultValue={g("name")} />
        </FormField>
      </FormSection>

      <FormSection title="Origem">
        <FormField id="sourceChannelId" label="Fonte" error={errors.sourceChannelId}>
          <NativeSelect id="sourceChannelId" name="sourceChannelId" defaultValue={g("sourceChannelId")}>
            <option value="">—</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="listingUrl" label="Link do anúncio" error={errors.listingUrl}>
          <Input id="listingUrl" name="listingUrl" inputMode="url" placeholder="idealista.pt/imovel/…" defaultValue={g("listingUrl")} />
        </FormField>
        {newContact ? (
          <>
            <FormField id="newContactName" label="Nome do contacto" error={errors.newContactName}>
              <Input id="newContactName" name="newContactName" defaultValue={g("newContactName")} />
            </FormField>
            <FormField id="newContactPhone" label="Telefone" error={errors.newContactPhone}>
              <Input id="newContactPhone" name="newContactPhone" type="tel" defaultValue={g("newContactPhone")} />
            </FormField>
            <FormField id="newContactCompany" label="Agência" error={errors.newContactCompany}>
              <Input id="newContactCompany" name="newContactCompany" defaultValue={g("newContactCompany")} />
            </FormField>
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewContact(false)}>
                Escolher contacto existente
              </Button>
            </div>
          </>
        ) : (
          <>
            <FormField id="sourceContactId" label="Contacto (consultor / proprietário)" error={errors.sourceContactId}>
              <NativeSelect id="sourceContactId" name="sourceContactId" defaultValue={g("sourceContactId")}>
                <option value="">—</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.companyName ? ` · ${c.companyName}` : ""}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewContact(true)}>
                + Novo contacto
              </Button>
            </div>
          </>
        )}
      </FormSection>

      <FormSection title="Próxima ação">
        <FormField id="nextAction" label="O que fazer a seguir" error={errors.nextAction}>
          <Input id="nextAction" name="nextAction" placeholder="Agendar visita, pedir plantas…" defaultValue={g("nextAction")} />
        </FormField>
        <FormField id="nextActionDate" label="Quando" error={errors.nextActionDate}>
          <Input id="nextActionDate" name="nextActionDate" type="date" defaultValue={g("nextActionDate")} />
        </FormField>
        <FormField id="sourceNotes" label="Observações" error={errors.sourceNotes} className="md:col-span-2">
          <Textarea id="sourceNotes" name="sourceNotes" rows={2} defaultValue={g("sourceNotes")} />
        </FormField>
      </FormSection>

      {state.error && !state.duplicates?.length ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <Link href="/deals">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "A criar…" : "Criar negócio"}
        </Button>
      </div>
    </form>
  );
}
