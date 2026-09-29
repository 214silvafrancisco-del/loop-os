CREATE TABLE "budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"depth" integer DEFAULT 0 NOT NULL,
	"code" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"category_id" uuid,
	"description" text NOT NULL,
	"supplier_id" uuid,
	"quantity" numeric(12, 3),
	"unit" text,
	"unit_price" numeric(14, 4),
	"budgeted" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(7, 4) DEFAULT '0.2300' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_supplier_id_contacts_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_lines_project_parent_sort_idx" ON "budget_lines" USING btree ("project_id","parent_id","sort");--> statement-breakpoint
CREATE TRIGGER budget_lines_set_updated_at BEFORE UPDATE ON "budget_lines" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
-- Auditoria: tabelas com project_id resolvem o imóvel pela obra.
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
  v_project uuid;
  v_ignored text[] := ARRAY['updated_at','created_at','bp_profit_net','bp_margin','bp_roi','bp_roe','bp_annualized','bp_equity','active_scenario_id','address_normalized','phone_normalized','calculated_at','out_calc_version','current_version_id','data_snapshot','whatsapp_text','budgeted','sort','code'];
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
  v_user := COALESCE((v_new ->> 'updated_by')::uuid, (v_new ->> 'created_by')::uuid, (v_new ->> 'uploaded_by')::uuid, (v_old ->> 'updated_by')::uuid, (v_old ->> 'uploaded_by')::uuid);

  IF TG_TABLE_NAME = 'properties' THEN
    v_property := v_row;
  ELSIF TG_TABLE_NAME = 'deals' THEN
    v_property := COALESCE((v_new ->> 'property_id')::uuid, (v_old ->> 'property_id')::uuid);
  ELSIF TG_TABLE_NAME IN ('deal_notes', 'business_plans', 'proposals') THEN
    SELECT property_id INTO v_property FROM public.deals
      WHERE id = COALESCE((v_new ->> 'deal_id')::uuid, (v_old ->> 'deal_id')::uuid);
  ELSIF TG_TABLE_NAME IN ('bp_scenarios', 'bp_comparables') THEN
    SELECT d.property_id INTO v_property
      FROM public.business_plans bp JOIN public.deals d ON d.id = bp.deal_id
      WHERE bp.id = COALESCE((v_new ->> 'business_plan_id')::uuid, (v_old ->> 'business_plan_id')::uuid);
  ELSIF TG_TABLE_NAME = 'document_versions' THEN
    SELECT property_id, organization_id INTO v_property, v_org FROM public.documents
      WHERE id = COALESCE((v_new ->> 'document_id')::uuid, (v_old ->> 'document_id')::uuid);
  ELSIF v_new ? 'property_id' OR v_old ? 'property_id' THEN
    v_property := COALESCE((v_new ->> 'property_id')::uuid, (v_old ->> 'property_id')::uuid);
  ELSIF v_new ? 'project_id' OR v_old ? 'project_id' THEN
    v_project := COALESCE((v_new ->> 'project_id')::uuid, (v_old ->> 'project_id')::uuid);
    SELECT property_id INTO v_property FROM public.projects WHERE id = v_project;
  END IF;

  INSERT INTO public.audit_log (organization_id, table_name, row_id, property_id, action, changed_fields, old_data, new_data, user_id)
  VALUES (v_org, TG_TABLE_NAME, v_row, v_property, lower(TG_OP)::audit_action, v_changed, v_old, v_new, v_user);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER budget_lines_audit AFTER INSERT OR UPDATE OR DELETE ON "budget_lines" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
