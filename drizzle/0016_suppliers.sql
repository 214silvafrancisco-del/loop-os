CREATE TYPE "public"."supplier_control_mode" AS ENUM('autos', 'fatura');--> statement-breakpoint
CREATE TABLE "project_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"nif" text,
	"phone" text,
	"email" text,
	"control_mode" "supplier_control_mode" DEFAULT 'autos' NOT NULL,
	"contact_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "measurement_reports_project_month_idx";--> statement-breakpoint
DROP INDEX "invoices_supplier_idx";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "supplier_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD COLUMN "project_supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "project_supplier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "measurement_reports" ADD COLUMN "project_supplier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "project_suppliers" ADD CONSTRAINT "project_suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_suppliers" ADD CONSTRAINT "project_suppliers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_suppliers" ADD CONSTRAINT "project_suppliers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_suppliers_project_name_idx" ON "project_suppliers" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "project_suppliers_project_sort_idx" ON "project_suppliers" USING btree ("project_id","sort");--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_project_supplier_id_project_suppliers_id_fk" FOREIGN KEY ("project_supplier_id") REFERENCES "public"."project_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_supplier_id_project_suppliers_id_fk" FOREIGN KEY ("project_supplier_id") REFERENCES "public"."project_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_reports" ADD CONSTRAINT "measurement_reports_project_supplier_id_project_suppliers_id_fk" FOREIGN KEY ("project_supplier_id") REFERENCES "public"."project_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_lines_supplier_idx" ON "budget_lines" USING btree ("project_supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_reports_supplier_month_idx" ON "measurement_reports" USING btree ("project_supplier_id","period_month");--> statement-breakpoint
CREATE INDEX "invoices_supplier_idx" ON "invoices" USING btree ("project_supplier_id");
--> statement-breakpoint
CREATE TRIGGER project_suppliers_set_updated_at BEFORE UPDATE ON "project_suppliers" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER project_suppliers_audit AFTER INSERT OR UPDATE OR DELETE ON "project_suppliers" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
--> statement-breakpoint
-- Número de fatura único por fornecedor da obra (o índice antigo cai com a coluna supplier_id).
DROP INDEX IF EXISTS invoices_supplier_number_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX invoices_supplier_number_idx ON "invoices" (project_supplier_id, number) WHERE deleted_at IS NULL;
--> statement-breakpoint
-- Orçamentos existentes: um fornecedor "Por atribuir" por obra, para depois se moverem os capítulos.
INSERT INTO "project_suppliers" (organization_id, project_id, name, kind, control_mode, sort)
SELECT DISTINCT b.organization_id, b.project_id, 'Por atribuir', NULL::text, 'autos'::supplier_control_mode, 0
FROM "budget_lines" b
WHERE b.project_supplier_id IS NULL;
--> statement-breakpoint
UPDATE "budget_lines" b
SET project_supplier_id = s.id
FROM "project_suppliers" s
WHERE s.project_id = b.project_id AND s.name = 'Por atribuir' AND b.project_supplier_id IS NULL;
