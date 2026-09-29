CREATE TYPE "public"."scenario_kind" AS ENUM('ato_continuo', 'remodelacao', 'custom');--> statement-breakpoint
CREATE TYPE "public"."tax_regime" AS ENUM('empresa', 'particular');--> statement-breakpoint
CREATE TYPE "public"."works_method" AS ENUM('manual', 'per_m2');--> statement-breakpoint
CREATE TABLE "bp_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "scenario_kind" DEFAULT 'custom' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"sale_price" numeric(14, 2),
	"sale_commission_pct" numeric(7, 4) DEFAULT '0.0500' NOT NULL,
	"commission_vat_pct" numeric(7, 4) DEFAULT '0.2300' NOT NULL,
	"sale_cpcv_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"marketing_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"early_repayment_pct" numeric(7, 4) DEFAULT '0.0050' NOT NULL,
	"purchase_price" numeric(14, 2),
	"vpt" numeric(14, 2),
	"imt_regime" "imt_regime" DEFAULT 'isento' NOT NULL,
	"imt_override" numeric(14, 2),
	"stamp_duty_pct" numeric(7, 4) DEFAULT '0.0080' NOT NULL,
	"deed_cost" numeric(14, 2) DEFAULT '500' NOT NULL,
	"registration_cost" numeric(14, 2) DEFAULT '225' NOT NULL,
	"cpcv_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"acquisition_commission" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_acquisition" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ltv_pct" numeric(7, 4) DEFAULT '0' NOT NULL,
	"term_years" integer DEFAULT 40 NOT NULL,
	"interest_rate" numeric(7, 4) DEFAULT '0.0400' NOT NULL,
	"fee_dossier" numeric(14, 2) DEFAULT '300' NOT NULL,
	"fee_valuation" numeric(14, 2) DEFAULT '250' NOT NULL,
	"fee_formalization" numeric(14, 2) DEFAULT '700' NOT NULL,
	"stamp_duty_financing_pct" numeric(7, 4) DEFAULT '0.0060' NOT NULL,
	"mortgage_registration" numeric(14, 2) DEFAULT '250' NOT NULL,
	"works_method" "works_method" DEFAULT 'manual' NOT NULL,
	"works_budget" numeric(14, 2),
	"works_cost_per_m2" numeric(14, 2) DEFAULT '600' NOT NULL,
	"works_vat_pct" numeric(7, 4) DEFAULT '0.2300' NOT NULL,
	"contingency_pct" numeric(7, 4) DEFAULT '0' NOT NULL,
	"architecture_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"licenses_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"supervision_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_works" numeric(14, 2) DEFAULT '0' NOT NULL,
	"works_financed_pct" numeric(7, 4) DEFAULT '0' NOT NULL,
	"works_term_years" integer DEFAULT 40 NOT NULL,
	"works_interest_rate" numeric(7, 4) DEFAULT '0.0400' NOT NULL,
	"works_fee_dossier" numeric(14, 2) DEFAULT '300' NOT NULL,
	"works_fee_formalization" numeric(14, 2) DEFAULT '700' NOT NULL,
	"works_mortgage_registration" numeric(14, 2) DEFAULT '250' NOT NULL,
	"works_tranches" integer DEFAULT 2 NOT NULL,
	"holding_months" integer DEFAULT 6 NOT NULL,
	"insurance_month" numeric(14, 2) DEFAULT '30' NOT NULL,
	"condo_month" numeric(14, 2) DEFAULT '30' NOT NULL,
	"electricity_month" numeric(14, 2) DEFAULT '40' NOT NULL,
	"water_month" numeric(14, 2) DEFAULT '40' NOT NULL,
	"imi" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_holding" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_regime" "tax_regime" DEFAULT 'empresa' NOT NULL,
	"irc_pct" numeric(7, 4) DEFAULT '0.1900' NOT NULL,
	"irs_pct" numeric(7, 4) DEFAULT '0.4800' NOT NULL,
	"acquisition_date" date,
	"works_start" date,
	"works_end" date,
	"listing_date" date,
	"sale_date" date,
	"out_total_investment" numeric(14, 2),
	"out_equity" numeric(14, 2),
	"out_financing" numeric(14, 2),
	"out_total_costs" numeric(14, 2),
	"out_revenue" numeric(14, 2),
	"out_gross_profit" numeric(14, 2),
	"out_tax" numeric(14, 2),
	"out_net_profit" numeric(14, 2),
	"out_margin" numeric(9, 6),
	"out_roi" numeric(9, 6),
	"out_roe" numeric(9, 6),
	"out_annualized" numeric(9, 6),
	"out_irr" numeric(9, 6),
	"out_profit_per_m2" numeric(14, 2),
	"out_break_even_price" numeric(14, 2),
	"out_calc_version" text,
	"calculated_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"notes" text,
	"reference_m2_idealista" numeric(14, 2),
	"reference_m2_maxwork" numeric(14, 2),
	"reference_m2_consultant" numeric(14, 2),
	"valuation_m2" numeric(14, 2),
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bp_scenarios" ADD CONSTRAINT "bp_scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bp_scenarios" ADD CONSTRAINT "bp_scenarios_business_plan_id_business_plans_id_fk" FOREIGN KEY ("business_plan_id") REFERENCES "public"."business_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_plans" ADD CONSTRAINT "business_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_plans" ADD CONSTRAINT "business_plans_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bp_scenarios_plan_name_idx" ON "bp_scenarios" USING btree ("business_plan_id","name");--> statement-breakpoint
CREATE INDEX "bp_scenarios_plan_sort_idx" ON "bp_scenarios" USING btree ("business_plan_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "business_plans_deal_idx" ON "business_plans" USING btree ("deal_id");--> statement-breakpoint
CREATE TRIGGER business_plans_set_updated_at BEFORE UPDATE ON "business_plans" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER bp_scenarios_set_updated_at BEFORE UPDATE ON "bp_scenarios" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint

-- Auditoria: acrescenta a resolução de property_id para business_plans e bp_scenarios,
-- e ignora as colunas out_* (snapshot recalculado a cada gravação).
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_user uuid;
  v_org uuid;
  v_property uuid;
  v_row uuid;
  v_ignored text[] := ARRAY['updated_at','created_at','bp_profit_net','bp_margin','bp_roi','bp_roe','bp_annualized','bp_equity','active_scenario_id','address_normalized','phone_normalized','calculated_at','out_calc_version'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD); v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL; v_new := to_jsonb(NEW);
  ELSE
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    SELECT array_agg(key) INTO v_changed
      FROM jsonb_each(v_new) n
      WHERE NOT (key = ANY(v_ignored))
        AND key NOT LIKE 'out\_%'
        AND (v_old -> key) IS DISTINCT FROM (v_new -> key);
    IF v_changed IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  v_row := COALESCE((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  v_org := COALESCE((v_new ->> 'organization_id')::uuid, (v_old ->> 'organization_id')::uuid);
  v_user := COALESCE((v_new ->> 'updated_by')::uuid, (v_new ->> 'created_by')::uuid, (v_old ->> 'updated_by')::uuid);

  IF TG_TABLE_NAME = 'properties' THEN
    v_property := v_row;
  ELSIF TG_TABLE_NAME = 'deals' THEN
    v_property := COALESCE((v_new ->> 'property_id')::uuid, (v_old ->> 'property_id')::uuid);
  ELSIF TG_TABLE_NAME IN ('deal_notes', 'business_plans') THEN
    SELECT property_id INTO v_property FROM public.deals
      WHERE id = COALESCE((v_new ->> 'deal_id')::uuid, (v_old ->> 'deal_id')::uuid);
  ELSIF TG_TABLE_NAME = 'bp_scenarios' THEN
    SELECT d.property_id INTO v_property
      FROM public.business_plans bp JOIN public.deals d ON d.id = bp.deal_id
      WHERE bp.id = COALESCE((v_new ->> 'business_plan_id')::uuid, (v_old ->> 'business_plan_id')::uuid);
  ELSIF v_new ? 'property_id' OR v_old ? 'property_id' THEN
    v_property := COALESCE((v_new ->> 'property_id')::uuid, (v_old ->> 'property_id')::uuid);
  END IF;

  INSERT INTO public.audit_log (organization_id, table_name, row_id, property_id, action, changed_fields, old_data, new_data, user_id)
  VALUES (v_org, TG_TABLE_NAME, v_row, v_property, lower(TG_OP)::audit_action, v_changed, v_old, v_new, v_user);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER business_plans_audit AFTER INSERT OR UPDATE OR DELETE ON "business_plans" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
--> statement-breakpoint
CREATE TRIGGER bp_scenarios_audit AFTER INSERT OR UPDATE OR DELETE ON "bp_scenarios" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
