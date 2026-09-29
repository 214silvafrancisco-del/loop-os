// Ponto único de exportação do schema. Cada módulo novo acrescenta aqui o seu
// `schema.ts`; o drizzle-kit lê este ficheiro para gerar migrações.

export * from "./enums";
export * from "./core";
export * from "@/modules/settings/schema";
