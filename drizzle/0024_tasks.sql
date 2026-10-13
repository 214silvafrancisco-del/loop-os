CREATE TYPE "public"."task_entity" AS ENUM('deal', 'project', 'sale', 'sale_lead');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('por_iniciar', 'em_curso', 'concluida', 'bloqueada');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" "task_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"property_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"assignee_user_id" uuid,
	"due_date" date,
	"status" "task_status" DEFAULT 'por_iniciar' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_user_id_profiles_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_profiles_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_entity_idx" ON "tasks" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "tasks_org_status_due_idx" ON "tasks" USING btree ("organization_id","status","due_date");--> statement-breakpoint
CREATE INDEX "tasks_assignee_status_idx" ON "tasks" USING btree ("assignee_user_id","status");
--> statement-breakpoint
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON "tasks" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER tasks_audit AFTER INSERT OR UPDATE OR DELETE ON "tasks" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
--> statement-breakpoint
-- Próximas ações existentes passam a tarefas (as colunas next_action ficam como legado, sem uso).
INSERT INTO tasks (organization_id, entity_type, entity_id, property_id, title, assignee_user_id, due_date, status, created_by, updated_by, created_at)
SELECT d.organization_id, 'deal'::task_entity, d.id, d.property_id, coalesce(nullif(trim(d.next_action), ''), 'Próxima ação'), d.owner_user_id, d.next_action_date, 'por_iniciar'::task_status, d.updated_by, d.updated_by, d.updated_at
FROM deals d
WHERE d.deleted_at IS NULL AND d.status = 'active' AND (nullif(trim(d.next_action), '') IS NOT NULL OR d.next_action_date IS NOT NULL);
--> statement-breakpoint
INSERT INTO tasks (organization_id, entity_type, entity_id, property_id, title, assignee_user_id, due_date, status, created_by, updated_by, created_at)
SELECT s.organization_id, 'sale'::task_entity, s.id, s.property_id, coalesce(nullif(trim(s.next_action), ''), 'Próxima ação'), s.owner_user_id, s.next_action_date, 'por_iniciar'::task_status, s.updated_by, s.updated_by, s.updated_at
FROM sales s
WHERE s.deleted_at IS NULL AND s.stage IN ('preparacao', 'a_venda', 'cpcv') AND (nullif(trim(s.next_action), '') IS NOT NULL OR s.next_action_date IS NOT NULL);
--> statement-breakpoint
INSERT INTO tasks (organization_id, entity_type, entity_id, property_id, title, assignee_user_id, due_date, status, created_by, updated_by, created_at)
SELECT l.organization_id, 'sale_lead'::task_entity, l.id, l.property_id, coalesce(nullif(trim(l.next_action), ''), 'Próxima ação'), s.owner_user_id, l.next_action_date, 'por_iniciar'::task_status, l.updated_by, l.updated_by, l.updated_at
FROM sale_leads l JOIN sales s ON s.id = l.sale_id
WHERE l.status NOT IN ('ganho', 'perdido') AND (nullif(trim(l.next_action), '') IS NOT NULL OR l.next_action_date IS NOT NULL);
