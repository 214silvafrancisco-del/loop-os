CREATE TYPE "public"."contact_kind" AS ENUM('person', 'company');--> statement-breakpoint
CREATE TYPE "public"."contact_role" AS ENUM('consultor', 'proprietario', 'fornecedor', 'banco', 'advogado', 'arquiteto', 'outro');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "contact_kind" DEFAULT 'person' NOT NULL,
	"name" text NOT NULL,
	"roles" "contact_role"[] DEFAULT '{}' NOT NULL,
	"company_name" text,
	"phone" text,
	"phone_normalized" text,
	"email" text,
	"nif" text,
	"address" text,
	"iban" text,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_org_phone_idx" ON "contacts" USING btree ("organization_id","phone_normalized");--> statement-breakpoint
CREATE INDEX "contacts_org_nif_idx" ON "contacts" USING btree ("organization_id","nif");--> statement-breakpoint
CREATE INDEX "contacts_org_name_idx" ON "contacts" USING btree ("organization_id","name");--> statement-breakpoint
CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON "contacts"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
