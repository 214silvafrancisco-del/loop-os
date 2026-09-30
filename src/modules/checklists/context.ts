import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { normalizeText } from "@/core/lib/format";
import { todayIso } from "@/core/lib/dates";
import { bpComparables, bpScenarios, businessPlans } from "@/modules/business-plan/schema";
import { contacts } from "@/modules/contacts/schema";
import { deals } from "@/modules/deals/schema";
import { documents } from "@/modules/documents/schema";
import { budgetLines, invoices, measurementReports, payments, projectSuppliers, projects } from "@/modules/projects/schema";
import { properties } from "@/modules/properties/schema";
import { proposals } from "@/modules/proposals/schema";
import { dealStages, documentCategories, sourceChannels } from "@/modules/settings/schema";
import type { DealContext, ProjectContext } from "./rules";

const num = (v: string | number | null | undefined) => (v === null || v === undefined ? null : Number(v));

/** Categorias (normalizadas) com pelo menos um documento ativo no imóvel. */
async function docCategoriesForProperty(propertyId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ name: documentCategories.name })
    .from(documents)
    .innerJoin(documentCategories, eq(documents.categoryId, documentCategories.id))
    .where(and(eq(documents.propertyId, propertyId), eq(documents.status, "active"), isNull(documents.deletedAt)));
  return rows.map((r) => normalizeText(r.name));
}

export type DealEntity = { propertyId: string; ownerUserId: string | null };

export async function loadDealContext(organizationId: string, dealId: string): Promise<{ entity: DealEntity; ctx: DealContext } | null> {
  const [row] = await db
    .select({
      deal: deals,
      property: properties,
      stageIsPurchase: dealStages.isPurchase,
      sourceChannelName: sourceChannels.name,
      contactPhone: contacts.phone,
    })
    .from(deals)
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .innerJoin(dealStages, eq(deals.stageId, dealStages.id))
    .leftJoin(sourceChannels, eq(deals.sourceChannelId, sourceChannels.id))
    .leftJoin(contacts, eq(deals.sourceContactId, contacts.id))
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, organizationId), isNull(deals.deletedAt)));
  if (!row) return null;

  const [plan] = await db.select({ id: businessPlans.id }).from(businessPlans).where(eq(businessPlans.dealId, dealId));
  let comparablesCount = 0;
  let activeScenario: DealContext["activeScenario"] = null;
  if (plan) {
    const [c] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bpComparables)
      .where(and(eq(bpComparables.businessPlanId, plan.id), eq(bpComparables.isIncluded, true)));
    comparablesCount = c?.n ?? 0;
    const [s] = await db
      .select({ ltvPct: bpScenarios.ltvPct, calculatedAt: bpScenarios.calculatedAt })
      .from(bpScenarios)
      .where(and(eq(bpScenarios.businessPlanId, plan.id), eq(bpScenarios.isActive, true)));
    if (s) activeScenario = { ltvPct: num(s.ltvPct) ?? 0 };
  }

  const [p] = await db
    .select({
      count: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${proposals.status} in ('sent','accepted','rejected'))::int`,
      decided: sql<number>`count(*) filter (where ${proposals.status} in ('accepted','rejected'))::int`,
    })
    .from(proposals)
    .where(eq(proposals.dealId, dealId));

  const d = row.deal;
  const pr = row.property;
  return {
    entity: { propertyId: d.propertyId, ownerUserId: d.ownerUserId },
    ctx: {
      deal: {
        name: d.name,
        askingPrice: num(d.askingPrice),
        sourceChannelId: d.sourceChannelId,
        sourceChannelName: row.sourceChannelName,
        sourceContactId: d.sourceContactId,
        contactPhone: row.contactPhone,
        ownerUserId: d.ownerUserId,
        nextAction: d.nextAction,
        nextActionDate: d.nextActionDate,
        maxPrice: num(d.maxPrice),
        finalPrice: num(d.finalPrice),
        deedDate: d.deedDate,
        cpcvDate: d.cpcvDate,
        status: d.status,
        sourceCommissionPct: num(d.sourceCommissionPct),
        stageIsPurchase: row.stageIsPurchase,
      },
      property: {
        addressLine: pr.addressLine,
        parish: pr.parish,
        municipality: pr.municipality,
        typology: pr.typology,
        grossArea: num(pr.grossArea),
        floor: pr.floor,
        constructionYear: pr.constructionYear,
        condition: pr.condition,
      },
      docCategories: await docCategoriesForProperty(d.propertyId),
      comparablesCount,
      activeScenario,
      proposals: { count: p?.count ?? 0, sent: p?.sent ?? 0, decided: p?.decided ?? 0 },
    },
  };
}

export type ProjectEntity = { propertyId: string; managerUserId: string | null };

export async function loadProjectContext(organizationId: string, projectId: string): Promise<{ entity: ProjectEntity; ctx: ProjectContext } | null> {
  const [pj] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId), isNull(projects.deletedAt)));
  if (!pj) return null;

  // Orçamento: folhas = linhas sem filhos; fornecedor definido no capítulo.
  const lines = await db
    .select({ id: budgetLines.id, parentId: budgetLines.parentId, depth: budgetLines.depth, categoryId: budgetLines.categoryId, supplierId: budgetLines.projectSupplierId, budgeted: budgetLines.budgeted })
    .from(budgetLines)
    .where(eq(budgetLines.projectId, projectId));
  const parents = new Set(lines.map((l) => l.parentId).filter(Boolean));
  const leaves = lines.filter((l) => !parents.has(l.id));
  const chapters = lines.filter((l) => l.depth === 0);
  const budget = {
    lineCount: lines.length,
    total: leaves.reduce((s, l) => s + Number(l.budgeted), 0),
    chaptersWithCategory: chapters.filter((l) => l.categoryId).length,
    chapterCount: chapters.length,
    chaptersWithSupplier: chapters.filter((l) => l.supplierId).length,
    leafCount: leaves.length,
  };

  // Fornecedores e os seus autos
  const sups = await db
    .select({ id: projectSuppliers.id, name: projectSuppliers.name, controlMode: projectSuppliers.controlMode })
    .from(projectSuppliers)
    .where(eq(projectSuppliers.projectId, projectId));
  const reports = await db
    .select({ supplierId: measurementReports.projectSupplierId, status: measurementReports.status, periodMonth: measurementReports.periodMonth, totalCumulative: measurementReports.totalCumulative })
    .from(measurementReports)
    .where(eq(measurementReports.projectId, projectId));
  const suppliers = sups.map((s) => {
    const mine = reports.filter((r) => r.supplierId === s.id);
    const closed = mine.filter((r) => r.status === "closed").sort((a, b) => (a.periodMonth < b.periodMonth ? 1 : -1));
    return {
      id: s.id,
      name: s.name,
      controlMode: s.controlMode,
      budgeted: leaves.filter((l) => l.supplierId === s.id).reduce((a, l) => a + Number(l.budgeted), 0),
      closedCount: closed.length,
      draftCount: mine.length - closed.length,
      lastClosedMonth: closed[0]?.periodMonth ?? null,
      lastClosedCumulative: closed[0] ? Number(closed[0].totalCumulative) : 0,
    };
  });

  // Faturas e pagamentos
  const today = todayIso();
  const inv = await db
    .select({
      id: invoices.id,
      total: invoices.total,
      dueDate: invoices.dueDate,
      paid: sql<string>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.invoiceId} = ${invoices.id}), 0)`,
    })
    .from(invoices)
    .where(and(eq(invoices.projectId, projectId), isNull(invoices.deletedAt)));
  const [pay] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(invoices.projectId, projectId), isNull(invoices.deletedAt)));

  return {
    entity: { propertyId: pj.propertyId, managerUserId: pj.managerUserId },
    ctx: {
      project: {
        managerUserId: pj.managerUserId,
        plannedStart: pj.plannedStart,
        plannedEnd: pj.plannedEnd,
        actualStart: pj.actualStart,
        actualEnd: pj.actualEnd,
        status: pj.status,
      },
      budget,
      docCategories: await docCategoriesForProperty(pj.propertyId),
      suppliers,
      invoices: {
        count: inv.length,
        total: inv.reduce((s, i) => s + Number(i.total), 0),
        paid: inv.reduce((s, i) => s + Number(i.paid), 0),
        overdueUnpaid: inv.filter((i) => i.dueDate && i.dueDate < today && Number(i.paid) < Number(i.total) - 0.01).length,
      },
      paymentsCount: pay?.n ?? 0,
      today,
    },
  };
}
