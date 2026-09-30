ALTER TABLE "budget_lines" DROP CONSTRAINT "budget_lines_supplier_id_contacts_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_supplier_id_contacts_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_lines" DROP COLUMN "supplier_id";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "supplier_id";