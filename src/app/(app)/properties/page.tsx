import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { NativeSelect } from "@/core/ui/form-field";
import { PageHeader } from "@/core/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertiesTable } from "@/modules/properties/components/properties-table";
import { listMunicipalities, listProperties } from "@/modules/properties/queries";
import {
  PROPERTY_STATUSES,
  PROPERTY_STATUS_LABEL,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABEL,
} from "@/modules/properties/validation";

export const metadata: Metadata = { title: "Imóveis" };

type Search = { q?: string; status?: string; type?: string; municipality?: string };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = (PROPERTY_STATUSES as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as (typeof PROPERTY_STATUSES)[number])
    : undefined;
  const propertyType = (PROPERTY_TYPES as readonly string[]).includes(sp.type ?? "")
    ? (sp.type as (typeof PROPERTY_TYPES)[number])
    : undefined;
  const municipality = sp.municipality?.trim() || undefined;

  const [properties, municipalities] = await Promise.all([
    listProperties(user.organizationId, { q: sp.q, status, propertyType, municipality }),
    listMunicipalities(user.organizationId),
  ]);
  const hasFilters = Boolean(sp.q || status || propertyType || municipality);

  return (
    <>
      <PageHeader
        title="Imóveis"
        description="Um registo por imóvel, do lead à venda."
        actions={
          <Button asChild size="sm" className="gap-1">
            <Link href="/properties/new">
              <Plus className="size-4" />
              Novo imóvel
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Ref, morada, freguesia, código postal" className="pl-8" />
        </div>
        <NativeSelect name="status" defaultValue={status ?? ""} className="w-auto">
          <option value="">Todos os estados</option>
          {PROPERTY_STATUSES.map((s) => (
            <option key={s} value={s}>{PROPERTY_STATUS_LABEL[s]}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="type" defaultValue={propertyType ?? ""} className="w-auto">
          <option value="">Todos os tipos</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="municipality" defaultValue={municipality ?? ""} className="w-auto">
          <option value="">Todos os concelhos</option>
          {municipalities.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">Filtrar</Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/properties">Limpar</Link>
          </Button>
        ) : null}
      </form>

      <p className="mb-2 text-xs text-muted-foreground">
        {properties.length} {properties.length === 1 ? "imóvel" : "imóveis"}
      </p>
      <PropertiesTable properties={properties} />
    </>
  );
}
