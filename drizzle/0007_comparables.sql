CREATE TABLE "bp_comparables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_plan_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"label" text,
	"source_url" text,
	"price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"area" numeric(10, 2) DEFAULT '0' NOT NULL,
	"floor" text,
	"has_elevator" boolean,
	"condition" "property_condition",
	"adj_negotiation" numeric(7, 4) DEFAULT '-0.0500' NOT NULL,
	"adj_area" numeric(7, 4) DEFAULT '0' NOT NULL,
	"adj_location" numeric(7, 4) DEFAULT '0' NOT NULL,
	"adj_age" numeric(7, 4) DEFAULT '0' NOT NULL,
	"adj_condition" numeric(7, 4) DEFAULT '0' NOT NULL,
	"adj_other" numeric(7, 4) DEFAULT '0' NOT NULL,
	"notes" text,
	"is_included" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bp_comparables" ADD CONSTRAINT "bp_comparables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bp_comparables" ADD CONSTRAINT "bp_comparables_business_plan_id_business_plans_id_fk" FOREIGN KEY ("business_plan_id") REFERENCES "public"."business_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bp_comparables_plan_sort_idx" ON "bp_comparables" USING btree ("business_plan_id","sort");--> statement-breakpoint
CREATE TRIGGER bp_comparables_set_updated_at BEFORE UPDATE ON "bp_comparables" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
-- Auditoria: bp_comparables resolve o imóvel pelo business plan, como bp_scenarios.
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
  ELSIF TG_TABLE_NAME IN ('bp_scenarios', 'bp_comparables') THEN
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
CREATE TRIGGER bp_comparables_audit AFTER INSERT OR UPDATE OR DELETE ON "bp_comparables" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
