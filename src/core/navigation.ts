import type { AppModule } from "@/core/auth/access";
import {
  Building2,
  CheckSquare,
  Handshake,
  HardHat,
  LayoutDashboard,
  Settings,
  Tag,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece na barra inferior em mobile (máx. 5). */
  mobile?: boolean;
  /** Módulo necessário (Fase 3); sem ele, o item não aparece. */
  module?: AppModule;
  /** Só para o admin. */
  adminOnly?: boolean;
};

/**
 * Navegação principal. Módulos futuros (Vendas, Financeiro, Fornecedores,
 * Documentos, Reporting, Tarefas, Calendário, CRM) entram aqui sem tocar
 * nos componentes da shell.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare, mobile: true },
  { href: "/deals", label: "Negócios", icon: Handshake, mobile: true, module: "negocios" },
  { href: "/projects", label: "Obras", icon: HardHat, mobile: true, module: "obras" },
  { href: "/sales", label: "Vendas", icon: Tag, mobile: true, module: "vendas" },
  // No telemóvel a barra tem 5 lugares: Imóveis e Contactos ficam no menu do utilizador.
  { href: "/properties", label: "Imóveis", icon: Building2, module: "imoveis" },
  { href: "/contacts", label: "Contactos", icon: Users, module: "contactos" },
  { href: "/funil", label: "Funil comercial", icon: TrendingUp, module: "funil" },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/settings", label: "Definições", icon: Settings, adminOnly: true },
];

/** Itens visíveis para um utilizador: módulo com acesso e, nos de admin, papel admin. */
export function visibleNavItems(items: NavItem[], user: { role: string; modules: readonly AppModule[] }): NavItem[] {
  return items.filter((i) => (!i.module || user.role === "admin" || user.modules.includes(i.module)) && (!i.adminOnly || user.role === "admin"));
}
