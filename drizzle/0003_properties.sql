CREATE TYPE "public"."property_condition" AS ENUM('para_obras', 'habitavel', 'remodelado', 'novo');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('prospect', 'owned', 'for_sale', 'sold');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartamento', 'predio', 'moradia', 'loja', 'terreno', 'outro');--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ref" text DEFAULT '' NOT NULL,
	"property_type" "property_type" DEFAULT 'apartamento' NOT NULL,
	"status" "property_status" DEFAULT 'prospect' NOT NULL,
	"name" text,
	"address_line" text NOT NULL,
	"address_normalized" text DEFAULT '' NOT NULL,
	"postal_code" text,
	"parish" text,
	"municipality" text,
	"district" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"typology" text,
	"gross_area" numeric(10, 2),
	"net_area" numeric(10, 2),
	"floor" text,
	"floors_count" integer,
	"has_elevator" boolean,
	"has_garage" boolean,
	"parking_spaces" integer,
	"has_balcony" boolean,
	"has_terrace" boolean,
	"has_yard" boolean,
	"bedrooms" integer,
	"bathrooms" integer,
	"condition" "property_condition",
	"construction_year" integer,
	"energy_class" text,
	"vpt" numeric(14, 2),
	"is_aru" boolean DEFAULT false NOT NULL,
	"matrix_article" text,
	"fraction" text,
	"land_registry_description" text,
	"land_registry_office" text,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "properties_org_ref_idx" ON "properties" USING btree ("organization_id","ref");--> statement-breakpoint
CREATE INDEX "properties_org_status_idx" ON "properties" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "properties_org_address_idx" ON "properties" USING btree ("organization_id","address_normalized");--> statement-breakpoint
CREATE INDEX "properties_org_municipality_idx" ON "properties" USING btree ("organization_id","municipality");--> statement-breakpoint
-- Referência LH-0001 atribuída na inserção, a partir do contador da organização.
-- O UPDATE ... RETURNING bloqueia a linha da organização, por isso duas
-- inserções simultâneas nunca recebem o mesmo número.
CREATE OR REPLACE FUNCTION public.assign_property_ref()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  seq integer;
BEGIN
  IF NEW.ref IS NULL OR NEW.ref = '' THEN
    UPDATE public.organizations
      SET next_property_seq = next_property_seq + 1
      WHERE id = NEW.organization_id
      RETURNING next_property_seq - 1 INTO seq;
    NEW.ref := 'LH-' || lpad(seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER properties_assign_ref
  BEFORE INSERT ON "properties"
  FOR EACH ROW EXECUTE FUNCTION public.assign_property_ref();
--> statement-breakpoint
CREATE TRIGGER properties_set_updated_at
  BEFORE UPDATE ON "properties"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
