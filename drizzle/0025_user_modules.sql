CREATE TABLE "user_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_modules_user_module_idx" ON "user_modules" USING btree ("user_id","module");
--> statement-breakpoint
-- Acessos iniciais (decisão 5 da Fase 1): Duarte com todos os módulos; Gonçalo com Negócios, Imóveis e Contactos. O admin não precisa de linhas.
INSERT INTO user_modules (user_id, module)
SELECT p.id, m.module FROM profiles p CROSS JOIN (VALUES ('negocios'), ('imoveis'), ('contactos'), ('obras'), ('vendas'), ('funil')) AS m(module)
WHERE p.email = 'duartesilva98@gmail.com'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO user_modules (user_id, module)
SELECT p.id, m.module FROM profiles p CROSS JOIN (VALUES ('negocios'), ('imoveis'), ('contactos')) AS m(module)
WHERE p.email = 'goncalo4141@gmail.com'
ON CONFLICT DO NOTHING;
