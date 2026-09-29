CREATE TYPE "public"."deal_status" AS ENUM('active', 'excluded');--> statement-breakpoint
CREATE TABLE "deal_tags" (
	"deal_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "deal_tags_deal_id_tag_id_pk" PRIMARY KEY("deal_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"seq" integer DEFAULT 1 NOT NULL,
	"name" text,
	"stage_id" uuid NOT NULL,
	"status" "deal_status" DEFAULT 'active' NOT NULL,
	"excluded_at" timestamp with time zone,
	"owner_user_id" uuid,
	"entered_at" date DEFAULT now() NOT NULL,
	"source_channel_id" uuid,
	"source_contact_id" uuid,
	"listing_url" text,
	"source_commission_pct" numeric(7, 4),
	"source_notes" text,
	"next_action" text,
	"next_action_date" date,
	"asking_price" numeric(14, 2),
	"target_price" numeric(14, 2),
	"max_price" numeric(14, 2),
	"estimated_works" numeric(14, 2),
	"estimated_sale_price" numeric(14, 2),
	"final_price" numeric(14, 2),
	"cpcv_date" date,
	"deed_date" date,
	"actual_acquisition_costs" numeric(14, 2),
	"imt_resale_deadline" date,
	"active_scenario_id" uuid,
	"bp_profit_net" numeric(14, 2),
	"bp_margin" numeric(9, 6),
	"bp_roi" numeric(9, 6),
	"bp_roe" numeric(9, 6),
	"bp_annualized" numeric(9, 6),
	"bp_equity" numeric(14, 2),
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_deal_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."deal_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_user_id_profiles_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_source_channel_id_source_channels_id_fk" FOREIGN KEY ("source_channel_id") REFERENCES "public"."source_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_source_contact_id_contacts_id_fk" FOREIGN KEY ("source_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deals_property_seq_idx" ON "deals" USING btree ("property_id","seq");--> statement-breakpoint
CREATE INDEX "deals_org_status_stage_idx" ON "deals" USING btree ("organization_id","status","stage_id");--> statement-breakpoint
CREATE INDEX "deals_org_next_action_idx" ON "deals" USING btree ("organization_id","next_action_date");--> statement-breakpoint
CREATE INDEX "deals_owner_idx" ON "deals" USING btree ("owner_user_id");--> statement-breakpoint
CREATE TRIGGER deals_set_updated_at
  BEFORE UPDATE ON "deals"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
