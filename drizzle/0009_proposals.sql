CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'generated', 'sent', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "proposal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"layout_key" text NOT NULL,
	"pdf_defaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"whatsapp_template" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"template_id" uuid,
	"number" text NOT NULL,
	"version_no" integer DEFAULT 1 NOT NULL,
	"status" "proposal_status" DEFAULT 'generated' NOT NULL,
	"offer_price" numeric(14, 2) NOT NULL,
	"deadline_days" integer,
	"validity_days" integer,
	"conditions" text,
	"observations" text,
	"data_snapshot" jsonb NOT NULL,
	"whatsapp_text" text,
	"document_id" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_template_id_proposal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."proposal_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_templates_org_code_idx" ON "proposal_templates" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_number_version_idx" ON "proposals" USING btree ("organization_id","number","version_no");--> statement-breakpoint
CREATE INDEX "proposals_deal_idx" ON "proposals" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE TRIGGER proposal_templates_set_updated_at BEFORE UPDATE ON "proposal_templates" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER proposals_set_updated_at BEFORE UPDATE ON "proposals" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
-- Auditoria: proposals resolve o imóvel pelo negócio (deal_id), como deal_notes.
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
  v_ignored text[] := ARRAY['updated_at','created_at','bp_profit_net','bp_margin','bp_roi','bp_roe','bp_annualized','bp_equity','active_scenario_id','address_normalized','phone_normalized','calculated_at','out_calc_version','current_version_id','data_snapshot','whatsapp_text'];
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
  END IF;

  INSERT INTO public.audit_log (organization_id, table_name, row_id, property_id, action, changed_fields, old_data, new_data, user_id)
  VALUES (v_org, TG_TABLE_NAME, v_row, v_property, lower(TG_OP)::audit_action, v_changed, v_old, v_new, v_user);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER proposals_audit AFTER INSERT OR UPDATE OR DELETE ON "proposals" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
--> statement-breakpoint
-- Template inicial para todas as organizações existentes.
INSERT INTO "proposal_templates" (organization_id, code, name, layout_key, pdf_defaults, whatsapp_template, sort)
SELECT id, 'proposta-aquisicao', 'Proposta de aquisição', 'proposta-aquisicao',
  '{"deadlineDays": 60, "validityDays": 7}'::jsonb,
  NULL, 1
FROM "organizations"
ON CONFLICT DO NOTHING;
