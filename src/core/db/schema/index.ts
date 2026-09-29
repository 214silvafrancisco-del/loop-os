// Ponto único de exportação do schema. Cada módulo novo acrescenta aqui o seu
// `schema.ts`; o drizzle-kit lê este ficheiro para gerar migrações.

export * from "./enums";
export * from "./core";
export * from "./audit";
export * from "@/modules/settings/schema";
export * from "@/modules/contacts/schema";
export * from "@/modules/properties/schema";
export * from "@/modules/deals/schema";
export * from "@/modules/business-plan/schema";
export * from "@/modules/documents/schema";
