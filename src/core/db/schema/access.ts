import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./core";

/**
 * Acesso de um utilizador a um módulo (Fase 3). A presença da linha é «com
 * acesso»; a ausência é «sem acesso». O admin não precisa de linhas.
 * `module` é uma das chaves de `APP_MODULES` (src/core/auth/access.ts).
 */
export const userModules = pgTable(
  "user_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("user_modules_user_module_idx").on(t.userId, t.module)],
);
