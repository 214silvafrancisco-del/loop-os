"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection, NativeSelect } from "@/core/ui/form-field";
import type { PropertyFormState } from "../actions";
import type { Property } from "../schema";
import {
  ENERGY_CLASSES,
  PROPERTY_CONDITIONS,
  PROPERTY_CONDITION_LABEL,
  PROPERTY_STATUSES,
  PROPERTY_STATUS_LABEL,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABEL,
  TYPOLOGIES,
} from "../validation";

type Props = {
  action: (prev: PropertyFormState, formData: FormData) => Promise<PropertyFormState>;
  property?: Property | null;
  cancelHref: string;
  parishes?: { parish: string; municipality: string | null }[];
  municipalities?: string[];
};

/** Sim / Não / Desconhecido, enviado como "1" / "0" / "". */
function TriSelect({ id, name, defaultValue }: { id: string; name: string; defaultValue: string }) {
  return (
    <NativeSelect id={id} name={name} defaultValue={defaultValue}>
      <option value="">—</option>
      <option value="1">Sim</option>
      <option value="0">Não</option>
    </NativeSelect>
  );
}

function triValue(v: boolean | null | undefined): string {
  return v === true ? "1" : v === false ? "0" : "";
}

function str(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

export function PropertyForm({ action, property, cancelHref, parishes = [], municipalities = [] }: Props) {
  const [state, formAction, pending] = useActionState<PropertyFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};
  const v = state.values;
  const p = property;

  // Valores submetidos (após erro) > registo existente > vazio.
  const g = (key: keyof NonNullable<typeof v>, fromProperty: string | number | null | undefined) =>
    v ? str(v[key] as string | undefined) : str(fromProperty);
  const tri = (key: keyof NonNullable<typeof v>, fromProperty: boolean | null | undefined) =>
    v ? str(v[key] as string | undefined) : triValue(fromProperty);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormSection title="Identificação">
        <FormField id="propertyType" label="Tipo de imóvel" error={errors.propertyType}>
          <NativeSelect id="propertyType" name="propertyType" defaultValue={g("propertyType", p?.propertyType ?? "apartamento")}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="status" label="Estado" error={errors.status} hint="Muda automaticamente com o negócio e a venda.">
          <NativeSelect id="status" name="status" defaultValue={g("status", p?.status ?? "prospect")}>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s}>{PROPERTY_STATUS_LABEL[s]}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="name" label="Nome (opcional)" error={errors.name} hint="Ex.: T2 Charquinho" className="md:col-span-2">
          <Input id="name" name="name" defaultValue={g("name", p?.name)} />
        </FormField>
      </FormSection>

      <FormSection title="Localização">
        <FormField id="addressLine" label="Morada" error={errors.addressLine} className="md:col-span-2">
          <Input id="addressLine" name="addressLine" defaultValue={g("addressLine", p?.addressLine)} required autoFocus={!p} />
        </FormField>
        <FormField id="postalCode" label="Código postal" error={errors.postalCode}>
          <Input id="postalCode" name="postalCode" placeholder="0000-000" defaultValue={g("postalCode", p?.postalCode)} />
        </FormField>
        <FormField id="parish" label="Freguesia" error={errors.parish}>
          <Input id="parish" name="parish" list="parish-options" defaultValue={g("parish", p?.parish)} />
          <datalist id="parish-options">
            {parishes.map((x) => (
              <option key={x.parish} value={x.parish}>{x.municipality ?? ""}</option>
            ))}
          </datalist>
        </FormField>
        <FormField id="municipality" label="Concelho" error={errors.municipality}>
          <Input id="municipality" name="municipality" list="municipality-options" defaultValue={g("municipality", p?.municipality)} />
          <datalist id="municipality-options">
            {municipalities.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </FormField>
        <FormField id="district" label="Distrito" error={errors.district}>
          <Input id="district" name="district" defaultValue={g("district", p?.district)} />
        </FormField>
      </FormSection>

      <FormSection title="Características">
        <FormField id="typology" label="Tipologia" error={errors.typology}>
          <Input id="typology" name="typology" list="typology-options" placeholder="T2" defaultValue={g("typology", p?.typology)} />
          <datalist id="typology-options">
            {TYPOLOGIES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </FormField>
        <FormField id="condition" label="Estado de conservação" error={errors.condition}>
          <NativeSelect id="condition" name="condition" defaultValue={g("condition", p?.condition)}>
            <option value="">—</option>
            {PROPERTY_CONDITIONS.map((c) => (
              <option key={c} value={c}>{PROPERTY_CONDITION_LABEL[c]}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="grossArea" label="Área bruta (m²)" error={errors.grossArea}>
          <Input id="grossArea" name="grossArea" inputMode="decimal" defaultValue={g("grossArea", p?.grossArea)} />
        </FormField>
        <FormField id="netArea" label="Área útil (m²)" error={errors.netArea}>
          <Input id="netArea" name="netArea" inputMode="decimal" defaultValue={g("netArea", p?.netArea)} />
        </FormField>
        <FormField id="floor" label="Piso" error={errors.floor} hint="RC, CV, 1, 2…">
          <Input id="floor" name="floor" defaultValue={g("floor", p?.floor)} />
        </FormField>
        <FormField id="floorsCount" label="N.º de pisos (prédio)" error={errors.floorsCount}>
          <Input id="floorsCount" name="floorsCount" inputMode="numeric" defaultValue={g("floorsCount", p?.floorsCount)} />
        </FormField>
        <FormField id="bedrooms" label="Quartos" error={errors.bedrooms}>
          <Input id="bedrooms" name="bedrooms" inputMode="numeric" defaultValue={g("bedrooms", p?.bedrooms)} />
        </FormField>
        <FormField id="bathrooms" label="Casas de banho" error={errors.bathrooms}>
          <Input id="bathrooms" name="bathrooms" inputMode="numeric" defaultValue={g("bathrooms", p?.bathrooms)} />
        </FormField>
        <FormField id="hasElevator" label="Elevador">
          <TriSelect id="hasElevator" name="hasElevator" defaultValue={tri("hasElevator", p?.hasElevator)} />
        </FormField>
        <FormField id="hasGarage" label="Garagem">
          <TriSelect id="hasGarage" name="hasGarage" defaultValue={tri("hasGarage", p?.hasGarage)} />
        </FormField>
        <FormField id="parkingSpaces" label="Lugares de estacionamento" error={errors.parkingSpaces}>
          <Input id="parkingSpaces" name="parkingSpaces" inputMode="numeric" defaultValue={g("parkingSpaces", p?.parkingSpaces)} />
        </FormField>
        <FormField id="hasBalcony" label="Varanda">
          <TriSelect id="hasBalcony" name="hasBalcony" defaultValue={tri("hasBalcony", p?.hasBalcony)} />
        </FormField>
        <FormField id="hasTerrace" label="Terraço">
          <TriSelect id="hasTerrace" name="hasTerrace" defaultValue={tri("hasTerrace", p?.hasTerrace)} />
        </FormField>
        <FormField id="hasYard" label="Logradouro">
          <TriSelect id="hasYard" name="hasYard" defaultValue={tri("hasYard", p?.hasYard)} />
        </FormField>
        <FormField id="constructionYear" label="Ano de construção" error={errors.constructionYear}>
          <Input id="constructionYear" name="constructionYear" inputMode="numeric" defaultValue={g("constructionYear", p?.constructionYear)} />
        </FormField>
        <FormField id="energyClass" label="Classe energética" error={errors.energyClass}>
          <NativeSelect id="energyClass" name="energyClass" defaultValue={g("energyClass", p?.energyClass)}>
            <option value="">—</option>
            {ENERGY_CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </NativeSelect>
        </FormField>
      </FormSection>

      <FormSection title="Fiscal e registral" description="Usado pelo Business Plan (IMT, IVA de obra) e pela proposta.">
        <FormField id="vpt" label="VPT (€)" error={errors.vpt} hint="Valor patrimonial tributário da caderneta.">
          <Input id="vpt" name="vpt" inputMode="decimal" defaultValue={g("vpt", p?.vpt)} />
        </FormField>
        <div className="flex items-center gap-2 pt-6">
          <input
            id="isAru"
            name="isAru"
            type="checkbox"
            className="size-4 accent-primary"
            defaultChecked={v ? v.isAru === "on" : (p?.isAru ?? false)}
          />
          <label htmlFor="isAru" className="text-sm">Zona ARU (IVA de obra a 6 %)</label>
        </div>
        <FormField id="matrixArticle" label="Artigo matricial" error={errors.matrixArticle}>
          <Input id="matrixArticle" name="matrixArticle" defaultValue={g("matrixArticle", p?.matrixArticle)} />
        </FormField>
        <FormField id="fraction" label="Fração" error={errors.fraction}>
          <Input id="fraction" name="fraction" defaultValue={g("fraction", p?.fraction)} />
        </FormField>
        <FormField id="landRegistryDescription" label="Descrição predial" error={errors.landRegistryDescription}>
          <Input id="landRegistryDescription" name="landRegistryDescription" defaultValue={g("landRegistryDescription", p?.landRegistryDescription)} />
        </FormField>
        <FormField id="landRegistryOffice" label="Conservatória" error={errors.landRegistryOffice}>
          <Input id="landRegistryOffice" name="landRegistryOffice" defaultValue={g("landRegistryOffice", p?.landRegistryOffice)} />
        </FormField>
        <FormField id="notes" label="Observações" error={errors.notes} className="md:col-span-2">
          <Textarea id="notes" name="notes" rows={3} defaultValue={g("notes", p?.notes)} />
        </FormField>
      </FormSection>

      {state.error ? (
        <div className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-medium">{state.error}</p>
          {state.duplicates?.length ? (
            <>
              <p className="mt-1 text-muted-foreground">
                Existente: {state.duplicates.join("; ")}. Podes guardar na mesma.
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
