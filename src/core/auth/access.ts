/**
 * Acessos por módulo (Fase 3): dois estados por utilizador e módulo, «com
 * acesso» (linha em `user_modules`) ou «sem acesso». O admin (Founder) tem
 * acesso global e é o único que edita a matriz. Dashboard, Tarefas e as
 * notificações são sempre acessíveis e mostram só o que os acessos permitem.
 * Código puro, partilhado por servidor e cliente.
 */

export const APP_MODULES = [
  { key: "negocios", label: "Negócios", href: "/deals", description: "Negócios, imóveis em prospeção, análise, Business Plan, propostas" },
  { key: "imoveis", label: "Imóveis", href: "/properties", description: "Fichas dos imóveis e documentos do imóvel" },
  { key: "contactos", label: "Contactos", href: "/contacts", description: "Consultores, proprietários, fornecedores" },
  { key: "obras", label: "Obras", href: "/projects", description: "Orçamentos, autos, faturas e pagamentos" },
  { key: "vendas", label: "Vendas", href: "/sales", description: "Vendas, mediadoras, leads e resultado" },
  { key: "funil", label: "Funil comercial", href: "/funil", description: "Registo semanal e previsão de compras" },
] as const;

export type AppModule = (typeof APP_MODULES)[number]["key"];
export const MODULE_KEYS = APP_MODULES.map((m) => m.key) as AppModule[];
export const MODULE_LABEL = Object.fromEntries(APP_MODULES.map((m) => [m.key, m.label])) as Record<AppModule, string>;

export const isAppModule = (v: string): v is AppModule => (MODULE_KEYS as string[]).includes(v);

/** Utilizador tal como `getCurrentUser` o devolve (só o que interessa aqui). */
export type Accessor = { role: "admin" | "manager" | "user"; modules: readonly AppModule[] };

export function hasModule(user: Accessor, module: AppModule): boolean {
  return user.role === "admin" || user.modules.includes(module);
}

/** Módulos efetivos: o admin vê tudo. */
export function effectiveModules(role: Accessor["role"], granted: readonly string[]): AppModule[] {
  if (role === "admin") return [...MODULE_KEYS];
  return MODULE_KEYS.filter((m) => granted.includes(m));
}

/** Módulo que guarda cada tipo de registo (tarefas, procedimentos, documentos). */
export function moduleForEntity(entityType: string): AppModule {
  switch (entityType) {
    case "deal":
    case "proposal":
      return "negocios";
    case "property":
      return "imoveis";
    case "project":
    case "invoice":
    case "measurement_report":
      return "obras";
    case "sale":
    case "sale_lead":
      return "vendas";
    default:
      return "negocios";
  }
}

/** Tipos de registo (tarefas) cujo módulo o utilizador pode ver. */
export function allowedTaskEntities(user: Accessor): ("deal" | "project" | "sale" | "sale_lead")[] {
  const all = ["deal", "project", "sale", "sale_lead"] as const;
  return all.filter((e) => hasModule(user, moduleForEntity(e)));
}

/** Tipos de documento que o utilizador pode ver numa ficha de imóvel partilhada. */
export function allowedDocumentEntities(user: Accessor): string[] {
  const all = ["property", "deal", "project", "sale", "invoice", "proposal", "measurement_report"];
  return all.filter((e) => hasModule(user, moduleForEntity(e)));
}

/** Módulo a que uma rota pertence (para o menu e para a página «sem acesso»). */
export function moduleForPath(pathname: string): AppModule | null {
  const m = APP_MODULES.find((x) => pathname === x.href || pathname.startsWith(x.href + "/"));
  return m?.key ?? null;
}
