CREATE TYPE "public"."lead_source" AS ENUM('mediadora', 'portal', 'direto', 'outro');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('novo', 'visita_marcada', 'visitou', 'proposta', 'ganho', 'perdido');--> statement-breakpoint
CREATE TYPE "public"."sale_stage" AS ENUM('preparacao', 'a_venda', 'cpcv', 'vendido', 'cancelada');--> statement-breakpoint
ALTER TYPE "public"."deal_status" ADD VALUE 'sold';--> statement-breakpoint
CREATE TABLE "sale_agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"commission_pct" numeric(7, 4),
	"commission_fixed" numeric(14, 2),
	"commission_vat_pct" numeric(7, 4) DEFAULT '0.2300' NOT NULL,
	"exclusive" boolean DEFAULT false NOT NULL,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"contact_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"source" "lead_source" DEFAULT 'portal' NOT NULL,
	"agency_id" uuid,
	"status" "lead_status" DEFAULT 'novo' NOT NULL,
	"visit_date" date,
	"offer_amount" numeric(14, 2),
	"next_action" text,
	"next_action_date" date,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"deal_id" uuid,
	"project_id" uuid,
	"stage" "sale_stage" DEFAULT 'preparacao' NOT NULL,
	"owner_user_id" uuid,
	"listing_price" numeric(14, 2),
	"listing_date" date,
	"listing_url" text,
	"cpcv_date" date,
	"cpcv_deposit" numeric(14, 2),
	"deed_date" date,
	"sale_price" numeric(14, 2),
	"buyer_contact_id" uuid,
	"other_sale_costs" numeric(14, 2) DEFAULT '0' NOT NULL,
	"actual_holding_costs" numeric(14, 2),
	"actual_financing_costs" numeric(14, 2),
	"next_action" text,
	"next_action_date" date,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_agencies" ADD CONSTRAINT "sale_agencies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_agencies" ADD CONSTRAINT "sale_agencies_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_agencies" ADD CONSTRAINT "sale_agencies_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_agencies" ADD CONSTRAINT "sale_agencies_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_leads" ADD CONSTRAINT "sale_leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_leads" ADD CONSTRAINT "sale_leads_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_leads" ADD CONSTRAINT "sale_leads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_leads" ADD CONSTRAINT "sale_leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_leads" ADD CONSTRAINT "sale_leads_agency_id_sale_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."sale_agencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_owner_user_id_profiles_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_contact_id_contacts_id_fk" FOREIGN KEY ("buyer_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_agencies_sale_contact_idx" ON "sale_agencies" USING btree ("sale_id","contact_id");--> statement-breakpoint
CREATE INDEX "sale_leads_sale_status_idx" ON "sale_leads" USING btree ("sale_id","status");--> statement-breakpoint
CREATE INDEX "sale_leads_org_next_action_idx" ON "sale_leads" USING btree ("organization_id","next_action_date");--> statement-breakpoint
CREATE INDEX "sales_org_stage_idx" ON "sales" USING btree ("organization_id","stage");--> statement-breakpoint
CREATE INDEX "sales_org_next_action_idx" ON "sales" USING btree ("organization_id","next_action_date");--> statement-breakpoint
CREATE INDEX "sales_property_idx" ON "sales" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "sales_deal_idx" ON "sales" USING btree ("deal_id");
--> statement-breakpoint
CREATE TRIGGER sales_set_updated_at BEFORE UPDATE ON "sales" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER sales_audit AFTER INSERT OR UPDATE OR DELETE ON "sales" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
--> statement-breakpoint
CREATE TRIGGER sale_agencies_set_updated_at BEFORE UPDATE ON "sale_agencies" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER sale_agencies_audit AFTER INSERT OR UPDATE OR DELETE ON "sale_agencies" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
--> statement-breakpoint
CREATE TRIGGER sale_leads_set_updated_at BEFORE UPDATE ON "sale_leads" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER sale_leads_audit AFTER INSERT OR UPDATE OR DELETE ON "sale_leads" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
