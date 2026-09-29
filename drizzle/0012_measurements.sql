CREATE TYPE "public"."measurement_status" AS ENUM('draft', 'closed');--> statement-breakpoint
CREATE TABLE "measurement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"budget_line_id" uuid NOT NULL,
	"pct_cumulative" numeric(6, 4) DEFAULT '0' NOT NULL,
	"amount_cumulative" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_period" numeric(14, 2) DEFAULT '0' NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "measurement_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"period_month" date NOT NULL,
	"report_date" date NOT NULL,
	"status" "measurement_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"document_id" uuid,
	"total_period" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_cumulative" numeric(14, 2) DEFAULT '0' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurement_lines" ADD CONSTRAINT "measurement_lines_report_id_measurement_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."measurement_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_lines" ADD CONSTRAINT "measurement_lines_budget_line_id_budget_lines_id_fk" FOREIGN KEY ("budget_line_id") REFERENCES "public"."budget_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_reports" ADD CONSTRAINT "measurement_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_reports" ADD CONSTRAINT "measurement_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_lines_report_line_idx" ON "measurement_lines" USING btree ("report_id","budget_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_reports_project_number_idx" ON "measurement_reports" USING btree ("project_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_reports_project_month_idx" ON "measurement_reports" USING btree ("project_id","period_month");--> statement-breakpoint
CREATE TRIGGER measurement_reports_set_updated_at BEFORE UPDATE ON "measurement_reports" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
-- Auto fechado é imutável: só notas e documento podem mudar; linhas bloqueadas.
CREATE OR REPLACE FUNCTION public.lock_closed_measurement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'measurement_reports' THEN
    IF OLD.status = 'closed' AND (
      NEW.status <> 'closed' OR NEW.number <> OLD.number OR NEW.period_month <> OLD.period_month
      OR NEW.report_date <> OLD.report_date OR NEW.total_period <> OLD.total_period OR NEW.total_cumulative <> OLD.total_cumulative
    ) THEN
      RAISE EXCEPTION 'Auto de medição fechado não pode ser alterado (n.º %)', OLD.number;
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.measurement_reports r WHERE r.id = COALESCE(NEW.report_id, OLD.report_id) AND r.status = 'closed') THEN
    RAISE EXCEPTION 'As linhas de um auto fechado não podem ser alteradas';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER measurement_reports_lock BEFORE UPDATE ON "measurement_reports" FOR EACH ROW EXECUTE FUNCTION public.lock_closed_measurement();
--> statement-breakpoint
CREATE TRIGGER measurement_lines_lock BEFORE UPDATE OR DELETE ON "measurement_lines" FOR EACH ROW EXECUTE FUNCTION public.lock_closed_measurement();
--> statement-breakpoint
CREATE TRIGGER measurement_reports_audit AFTER INSERT OR UPDATE OR DELETE ON "measurement_reports" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
