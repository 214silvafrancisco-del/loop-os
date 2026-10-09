CREATE TABLE "funnel_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"leads" integer,
	"visits" integer,
	"proposals" integer,
	"purchases" integer,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funnel_weeks" ADD CONSTRAINT "funnel_weeks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_weeks_org_week_idx" ON "funnel_weeks" USING btree ("organization_id","week_start");
--> statement-breakpoint
CREATE TRIGGER funnel_weeks_set_updated_at BEFORE UPDATE ON "funnel_weeks" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER funnel_weeks_audit AFTER INSERT OR UPDATE OR DELETE ON "funnel_weeks" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
