CREATE TYPE "public"."measurement_kind" AS ENUM('trabalho', 'adiantamento');--> statement-breakpoint
DROP INDEX "measurement_reports_supplier_month_idx";--> statement-breakpoint
ALTER TABLE "measurement_reports" ADD COLUMN "kind" "measurement_kind" DEFAULT 'trabalho' NOT NULL;--> statement-breakpoint
ALTER TABLE "measurement_reports" ADD COLUMN "advance_pct" numeric(7, 4);--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_reports_supplier_month_idx" ON "measurement_reports" USING btree ("project_supplier_id","period_month") WHERE "measurement_reports"."kind" = 'trabalho';