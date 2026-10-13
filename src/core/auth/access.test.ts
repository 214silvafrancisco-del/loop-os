import { describe, expect, it } from "vitest";
import { allowedDocumentEntities, allowedTaskEntities, effectiveModules, hasModule, moduleForEntity, moduleForPath } from "./access";

describe("acessos por módulo", () => {
  it("admin tem tudo, mesmo sem linhas", () => {
    expect(effectiveModules("admin", [])).toHaveLength(6);
    expect(hasModule({ role: "admin", modules: [] }, "obras")).toBe(true);
  });
  it("utilizador só tem o que lhe foi dado; nada por defeito", () => {
    expect(effectiveModules("user", [])).toEqual([]);
    expect(effectiveModules("manager", ["negocios", "xpto"])).toEqual(["negocios"]);
    expect(hasModule({ role: "user", modules: ["negocios"] }, "obras")).toBe(false);
    expect(hasModule({ role: "user", modules: ["negocios"] }, "negocios")).toBe(true);
  });
  it("acesso a um módulo não concede outro", () => {
    const u = { role: "user" as const, modules: ["vendas" as const] };
    expect(hasModule(u, "obras")).toBe(false);
    expect(allowedTaskEntities(u)).toEqual(["sale", "sale_lead"]);
    expect(allowedDocumentEntities(u)).toEqual(["sale"]);
  });
  it("mapeia registos e rotas para módulos", () => {
    expect(moduleForEntity("invoice")).toBe("obras");
    expect(moduleForEntity("proposal")).toBe("negocios");
    expect(moduleForEntity("sale_lead")).toBe("vendas");
    expect(moduleForPath("/projects/123/faturas")).toBe("obras");
    expect(moduleForPath("/dashboard")).toBeNull();
  });
});
