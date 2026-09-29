import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { imtRegime } from "@/core/db/schema/enums";
import { organizationRef, timestamps } from "@/core/db/schema/helpers";
import { deals } from "@/modules/deals/schema";

export const scenarioKind = pgEnum("scenario_kind", ["ato_continuo", "remodelacao", "custom"]);
export const taxRegime = pgEnum("tax_regime", ["empresa", "particular"]);
export const worksMethod = pgEnum("works_method", ["manual", "per_m2"]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const pct = (name: string) => numeric(name, { precision: 7, scale: 4 });
const ratio = (name: string) => numeric(name, { precision: 9, scale: 6 });

/** Um Business Plan por negócio; os números vivem nos cenários. */
export const businessPlans = pgTable(
  "business_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    notes: text("notes"),
    // Avaliação por comparáveis (Step 10)
    referenceM2Idealista: money("reference_m2_idealista"),
    referenceM2Maxwork: money("reference_m2_maxwork"),
    referenceM2Consultant: money("reference_m2_consultant"),
    valuationM2: money("valuation_m2"),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [uniqueIndex("business_plans_deal_idx").on(t.dealId)],
);

/** Cenário: inputs em colunas tipadas + snapshot dos resultados (out_*). */
export const bpScenarios = pgTable(
  "bp_scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationRef(),
    businessPlanId: uuid("business_plan_id")
      .notNull()
      .references(() => businessPlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: scenarioKind("kind").notNull().default("custom"),
    sort: integer("sort").notNull().default(0),
    isActive: boolean("is_active").notNull().default(false),

    // Venda
    salePrice: money("sale_price"),
    saleCommissionPct: pct("sale_commission_pct").notNull().default("0.0500"),
    commissionVatPct: pct("commission_vat_pct").notNull().default("0.2300"),
    saleCpcvCost: money("sale_cpcv_cost").notNull().default("0"),
    marketingCost: money("marketing_cost").notNull().default("0"),
    earlyRepaymentPct: pct("early_repayment_pct").notNull().default("0.0050"),

    // Aquisição
    purchasePrice: money("purchase_price"),
    vpt: money("vpt"),
    imtRegime: imtRegime("imt_regime").notNull().default("isento"),
    imtOverride: money("imt_override"),
    stampDutyPct: pct("stamp_duty_pct").notNull().default("0.0080"),
    deedCost: money("deed_cost").notNull().default("500"),
    registrationCost: money("registration_cost").notNull().default("225"),
    cpcvCost: money("cpcv_cost").notNull().default("0"),
    acquisitionCommission: money("acquisition_commission").notNull().default("0"),
    otherAcquisition: money("other_acquisition").notNull().default("0"),

    // Financiamento do imóvel
    ltvPct: pct("ltv_pct").notNull().default("0"),
    termYears: integer("term_years").notNull().default(40),
    interestRate: pct("interest_rate").notNull().default("0.0400"),
    feeDossier: money("fee_dossier").notNull().default("300"),
    feeValuation: money("fee_valuation").notNull().default("250"),
    feeFormalization: money("fee_formalization").notNull().default("700"),
    stampDutyFinancingPct: pct("stamp_duty_financing_pct").notNull().default("0.0060"),
    mortgageRegistration: money("mortgage_registration").notNull().default("250"),

    // Obra
    worksMethod: worksMethod("works_method").notNull().default("manual"),
    worksBudget: money("works_budget"),
    worksCostPerM2: money("works_cost_per_m2").notNull().default("600"),
    worksVatPct: pct("works_vat_pct").notNull().default("0.2300"),
    contingencyPct: pct("contingency_pct").notNull().default("0"),
    architectureCost: money("architecture_cost").notNull().default("0"),
    licensesCost: money("licenses_cost").notNull().default("0"),
    supervisionCost: money("supervision_cost").notNull().default("0"),
    otherWorks: money("other_works").notNull().default("0"),
    worksFinancedPct: pct("works_financed_pct").notNull().default("0"),
    worksTermYears: integer("works_term_years").notNull().default(40),
    worksInterestRate: pct("works_interest_rate").notNull().default("0.0400"),
    worksFeeDossier: money("works_fee_dossier").notNull().default("300"),
    worksFeeFormalization: money("works_fee_formalization").notNull().default("700"),
    worksMortgageRegistration: money("works_mortgage_registration").notNull().default("250"),
    worksTranches: integer("works_tranches").notNull().default(2),

    // Detenção
    holdingMonths: integer("holding_months").notNull().default(6),
    insuranceMonth: money("insurance_month").notNull().default("30"),
    condoMonth: money("condo_month").notNull().default("30"),
    electricityMonth: money("electricity_month").notNull().default("40"),
    waterMonth: money("water_month").notNull().default("40"),
    imi: money("imi").notNull().default("0"),
    otherHolding: money("other_holding").notNull().default("0"),

    // Impostos
    taxRegime: taxRegime("tax_regime").notNull().default("empresa"),
    ircPct: pct("irc_pct").notNull().default("0.1900"),
    irsPct: pct("irs_pct").notNull().default("0.4800"),

    // Timeline (informativa; IRR na Phase 2)
    acquisitionDate: date("acquisition_date"),
    worksStart: date("works_start"),
    worksEnd: date("works_end"),
    listingDate: date("listing_date"),
    saleDate: date("sale_date"),

    // Snapshot dos resultados
    outTotalInvestment: money("out_total_investment"),
    outEquity: money("out_equity"),
    outFinancing: money("out_financing"),
    outTotalCosts: money("out_total_costs"),
    outRevenue: money("out_revenue"),
    outGrossProfit: money("out_gross_profit"),
    outTax: money("out_tax"),
    outNetProfit: money("out_net_profit"),
    outMargin: ratio("out_margin"),
    outRoi: ratio("out_roi"),
    outRoe: ratio("out_roe"),
    outAnnualized: ratio("out_annualized"),
    outIrr: ratio("out_irr"),
    outProfitPerM2: money("out_profit_per_m2"),
    outBreakEvenPrice: money("out_break_even_price"),
    outCalcVersion: text("out_calc_version"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }),

    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bp_scenarios_plan_name_idx").on(t.businessPlanId, t.name),
    index("bp_scenarios_plan_sort_idx").on(t.businessPlanId, t.sort),
  ],
);

export type BusinessPlan = typeof businessPlans.$inferSelect;
export type BpScenario = typeof bpScenarios.$inferSelect;
export type NewBpScenario = typeof bpScenarios.$inferInsert;
