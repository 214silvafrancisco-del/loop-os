import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { profiles } from "@/core/db/schema/core";
import { documents, documentVersions } from "@/modules/documents/schema";
import { proposals, proposalTemplates, type Proposal, type ProposalTemplate } from "./schema";

export type ProposalRow = Proposal & { authorName: string | null; versionId: string | null; fileName: string | null };

export async function listTemplates(organizationId: string): Promise<ProposalTemplate[]> {
  return db
    .select()
    .from(proposalTemplates)
    .where(and(eq(proposalTemplates.organizationId, organizationId), eq(proposalTemplates.isActive, true)))
    .orderBy(asc(proposalTemplates.sort));
}

export async function listProposals(organizationId: string, dealId: string): Promise<ProposalRow[]> {
  const rows = await db
    .select({
      proposal: proposals,
      authorName: profiles.fullName,
      versionId: documents.currentVersionId,
      fileName: documentVersions.fileName,
    })
    .from(proposals)
    .leftJoin(profiles, eq(proposals.createdBy, profiles.id))
    .leftJoin(documents, eq(proposals.documentId, documents.id))
    .leftJoin(documentVersions, eq(documents.currentVersionId, documentVersions.id))
    .where(and(eq(proposals.organizationId, organizationId), eq(proposals.dealId, dealId)))
    .orderBy(desc(proposals.generatedAt));
  return rows.map((r) => ({ ...r.proposal, authorName: r.authorName, versionId: r.versionId, fileName: r.fileName }));
}

export async function getProposal(organizationId: string, id: string): Promise<Proposal | null> {
  const [row] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.organizationId, organizationId), eq(proposals.id, id)))
    .limit(1);
  return row ?? null;
}
