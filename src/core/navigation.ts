import {
  Building2,
  Handshake,
  HardHat,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece na barra inferior em mobile (máx. 5). */
  mobile?: boolean;
};

/**
 * Navegação principal. Módulos futuros (Vendas, Financeiro, Fornecedores,
 * Documentos, Reporting, Tarefas, Calendário, CRM) entram aqui sem tocar
 * nos componentes da shell.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/deals", label: "Negócios", icon: Handshake, mobile: true },
  { href: "/projects", label: "Obras", icon: HardHat, mobile: true },
  { href: "/properties", label: "Imóveis", icon: Building2, mobile: true },
  { href: "/contacts", label: "Contactos", icon: Users, mobile: true },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/settings", label: "Definições", icon: Settings },
];
