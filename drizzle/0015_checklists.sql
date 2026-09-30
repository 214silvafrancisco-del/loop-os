CREATE TYPE "public"."checklist_entity" AS ENUM('deal', 'project');--> statement-breakpoint
CREATE TYPE "public"."checklist_item_kind" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."checklist_item_source" AS ENUM('auto', 'manual', 'context');--> statement-breakpoint
CREATE TYPE "public"."checklist_item_status" AS ENUM('pending', 'done', 'not_applicable');--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"template_item_id" uuid NOT NULL,
	"code" text NOT NULL,
	"section" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" "checklist_item_kind" NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"status" "checklist_item_status" DEFAULT 'pending' NOT NULL,
	"source" "checklist_item_source",
	"detail" text,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"na_note" text,
	"assignee_user_id" uuid,
	"due_date" date,
	"priority" integer,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"code" text NOT NULL,
	"section" text NOT NULL,
	"label" text NOT NULL,
	"help" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" "checklist_item_kind" DEFAULT 'manual' NOT NULL,
	"rule_key" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"applies_when" text,
	"depends_on_code" text,
	"default_assignee" text,
	"gates" text[] DEFAULT '{}' NOT NULL,
	"link_path" text
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"entity_type" "checklist_entity" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"trigger" text DEFAULT 'on_create' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"entity_type" "checklist_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"property_id" uuid,
	"done_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"progress" numeric(5, 4) DEFAULT '0' NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_template_item_id_checklist_template_items_id_fk" FOREIGN KEY ("template_item_id") REFERENCES "public"."checklist_template_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_completed_by_profiles_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_assignee_user_id_profiles_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_items_checklist_code_idx" ON "checklist_items" USING btree ("checklist_id","code");--> statement-breakpoint
CREATE INDEX "checklist_items_assignee_idx" ON "checklist_items" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_template_items_template_code_idx" ON "checklist_template_items" USING btree ("template_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_templates_org_code_version_idx" ON "checklist_templates" USING btree ("organization_id","code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "checklists_entity_idx" ON "checklists" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "checklists_org_idx" ON "checklists" USING btree ("organization_id");
--> statement-breakpoint
CREATE TRIGGER checklists_set_updated_at BEFORE UPDATE ON "checklists" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER checklist_items_set_updated_at BEFORE UPDATE ON "checklist_items" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
-- Auditoria: checklist_items resolve organização e imóvel pela checklist; contadores e detalhe não geram registo.
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
  v_ignored text[] := ARRAY['updated_at','created_at','bp_profit_net','bp_margin','bp_roi','bp_roe','bp_annualized','bp_equity','active_scenario_id','address_normalized','phone_normalized','calculated_at','out_calc_version','current_version_id','data_snapshot','whatsapp_text','budgeted','sort','code','detail','done_count','total_count','progress','synced_at'];
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
  ELSIF TG_TABLE_NAME = 'checklist_items' THEN
    SELECT property_id, organization_id INTO v_property, v_org FROM public.checklists
      WHERE id = COALESCE((v_new ->> 'checklist_id')::uuid, (v_old ->> 'checklist_id')::uuid);
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
CREATE TRIGGER checklist_items_audit AFTER INSERT OR UPDATE OR DELETE ON "checklist_items" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
