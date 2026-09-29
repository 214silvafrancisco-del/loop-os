import { pgEnum } from "drizzle-orm/pg-core";

// Enums transversais. Os enums de cada módulo (deal_status, project_status…)
// vivem no schema do respetivo módulo.

export const userRole = pgEnum("user_role", ["admin", "manager", "user"]);

export const imtRegime = pgEnum("imt_regime", ["isento", "hpp", "hs"]);

export const documentEntity = pgEnum("document_entity", [
  "property",
  "deal",
  "project",
  "sale",
  "invoice",
  "proposal",
  "measurement_report",
]);
