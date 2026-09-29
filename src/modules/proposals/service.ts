import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { createElement, type ReactElement } from "react";
import { db } from "@/core/db/client";
import { organizations } from "@/core/db/schema/core";
import { contacts } from "@/modules/contacts/schema";
import { deals } from "@/modules/deals/schema";
import { createDocumentWithFile } from "@/modules/documents/service";
import { properties } from "@/modules/properties/schema";
import { documentCategories } from "@/modules/settings/schema";
import { proposals, proposalTemplates, type Proposal } from "./schema";
import { DEFAULT_CONDITIONS, DEFAULT_WHATSAPP_TEMPLATE, renderWhatsapp, type ProposalSnapshot } from "./snapshot";
import { getLayout } from "./templates";

type Actor = { id: string; organizationId: string };

export type GenerateInput = {
  templateId: string;
  offerPrice: number;
  deadlineDays: number | null;
  validityDays: number | null;
  conditions: string | null;
  observations: string | null;
};

/** Logótipo para o PDF (PNG com fundo transparente). `null` se não existir. */
async function loadLogo(): Promise<string | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "brand", "logo.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** P-2026-001: sequência por ano, dentro da transação. */
async function nextProposalNumber(tx: typeof db, organizationId: string, year: number) {
  const prefix = `P-${year}-`;
  const [row] = await tx
    .select({ n: sql<number>`count(distinct ${proposals.number})::int` })
    .from(proposals)
    .where(and(eq(proposals.organizationId, organizationId), like(proposals.number, `${prefix}%`)));
  return `${prefix}${String((row?.n ?? 0) + 1).padStart(3, "0")}`;
}

export async function buildSnapshot(user: Actor, dealId: string, input: GenerateInput, number: string, versionNo: number): Promise<ProposalSnapshot> {
  const [row] = await db
    .select({ deal: deals, property: properties, contact: contacts, org: organizations })
    .from(deals)
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .innerJoin(organizations, eq(deals.organizationId, organizations.id))
    .leftJoin(contacts, eq(deals.sourceContactId, contacts.id))
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, user.organizationId)))
    .limit(1);
  if (!row) throw new Error("Negócio não encontrado.");
  const { deal, property, contact, org } = row;
  const today = new Date();
  const date = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const title = [property.typology, property.parish ?? property.municipality].filter(Boolean).join(" · ") || deal.name || property.addressLine;

  return {
    number,
    versionNo,
    date,
    company: {
      name: org.name,
      nif: org.nif,
      address: org.address,
      signature: org.settings.proposalSignature ?? org.name,
    },
    property: {
      ref: property.ref,
      title,
      addressLine: property.addressLine,
      postalCode: property.postalCode,
      parish: property.parish,
      municipality: property.municipality,
      typology: property.typology,
      grossArea: property.grossArea ? Number(property.grossArea) : null,
      floor: property.floor,
      matrixArticle: property.matrixArticle,
      fraction: property.fraction,
    },
    recipient: contact ? { name: contact.name, company: contact.companyName } : null,
    offer: {
      price: input.offerPrice,
      deadlineDays: input.deadlineDays,
      validityDays: input.validityDays,
      conditions: input.conditions,
      observations: input.observations,
    },
  };
}

/**
 * Gera o PDF, arquiva-o nos Documentos (Jurídico → Proposta) e regista a
 * proposta. Se já houver propostas neste negócio, mantém o número e sobe a versão.
 */
export async function generateProposal(user: Actor, dealId: string, input: GenerateInput): Promise<Proposal> {
  const [template] = await db
    .select()
    .from(proposalTemplates)
    .where(and(eq(proposalTemplates.id, input.templateId), eq(proposalTemplates.organizationId, user.organizationId)));
  if (!template) throw new Error("Template não encontrado.");

  const [previous] = await db
    .select({ number: proposals.number, versionNo: proposals.versionNo })
    .from(proposals)
    .where(and(eq(proposals.dealId, dealId), eq(proposals.organizationId, user.organizationId)))
    .orderBy(desc(proposals.generatedAt))
    .limit(1);
  const year = new Date().getFullYear();
  const number = previous?.number ?? (await nextProposalNumber(db, user.organizationId, year));
  const versionNo = previous ? previous.versionNo + 1 : 1;

  const snapshot = await buildSnapshot(user, dealId, input, number, versionNo);
  const Layout = getLayout(template.layoutKey);
  const logoSrc = await loadLogo();
  // O layout devolve um <Document>; o tipo de props do componente é o nosso, daí o cast.
  const element = createElement(Layout, { data: snapshot, logoSrc }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(element);
  const whatsappText = renderWhatsapp(template.whatsappTemplate ?? DEFAULT_WHATSAPP_TEMPLATE, snapshot);

  const [deal] = await db.select({ propertyId: deals.propertyId }).from(deals).where(eq(deals.id, dealId));
  const [category] = await db
    .select({ id: documentCategories.id })
    .from(documentCategories)
    .where(and(eq(documentCategories.organizationId, user.organizationId), eq(documentCategories.group, "juridico"), eq(documentCategories.name, "Proposta")))
    .limit(1);

  const fileName = `Proposta ${number}${versionNo > 1 ? ` v${versionNo}` : ""} - ${snapshot.property.ref}.pdf`;
  const { documentId } = await createDocumentWithFile(
    user,
    {
      propertyId: deal!.propertyId,
      entityType: "deal",
      entityId: dealId,
      categoryId: category?.id ?? null,
      name: `Proposta ${number}${versionNo > 1 ? ` (v${versionNo})` : ""}`,
      description: `Proposta de ${snapshot.offer.price.toLocaleString("pt-PT")} €`,
      docDate: snapshot.date,
    },
    { fileName, mimeType: "application/pdf", bytes: new Uint8Array(pdf) },
  );

  const [created] = await db
    .insert(proposals)
    .values({
      organizationId: user.organizationId,
      dealId,
      templateId: template.id,
      number,
      versionNo,
      status: "generated",
      offerPrice: input.offerPrice.toFixed(2),
      deadlineDays: input.deadlineDays,
      validityDays: input.validityDays,
      conditions: input.conditions,
      observations: input.observations,
      dataSnapshot: snapshot,
      whatsappText,
      documentId,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();
  return created!;
}

export { DEFAULT_CONDITIONS };
