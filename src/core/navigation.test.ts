import { describe, expect, it } from "vitest";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, visibleNavItems } from "./navigation";

const hrefs = (items: { href: string }[]) => items.map((i) => i.href);

describe("menu por acessos", () => {
  it("sem acessos só vê Dashboard e Tarefas", () => {
    expect(hrefs(visibleNavItems(NAV_ITEMS, { role: "user", modules: [] }))).toEqual(["/dashboard", "/tarefas"]);
    expect(visibleNavItems(SECONDARY_NAV_ITEMS, { role: "user", modules: [] })).toEqual([]);
  });
  it("só os módulos concedidos aparecem; Definições nunca para não-admin", () => {
    const items = visibleNavItems([...NAV_ITEMS, ...SECONDARY_NAV_ITEMS], { role: "manager", modules: ["negocios", "obras"] });
    expect(hrefs(items)).toEqual(["/dashboard", "/tarefas", "/deals", "/projects"]);
  });
  it("admin vê tudo, incluindo Definições", () => {
    const items = visibleNavItems([...NAV_ITEMS, ...SECONDARY_NAV_ITEMS], { role: "admin", modules: [] });
    expect(hrefs(items)).toContain("/settings");
    expect(items).toHaveLength(NAV_ITEMS.length + SECONDARY_NAV_ITEMS.length);
  });
  it("todos os itens de módulo estão marcados com o módulo certo", () => {
    const byHref = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i.module]));
    expect(byHref).toMatchObject({ "/deals": "negocios", "/projects": "obras", "/sales": "vendas", "/properties": "imoveis", "/contacts": "contactos", "/funil": "funil" });
    expect(byHref["/dashboard"]).toBeUndefined();
    expect(byHref["/tarefas"]).toBeUndefined();
  });
});
