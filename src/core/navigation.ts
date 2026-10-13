import {
  Building2,
  CheckSquare,
  Handshake,
  HardHat,
  LayoutDashboard,
  Settings,
  Tag,
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
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare, mobile: true },
  { href: "/deals", label: "Negócios", icon: Handshake, mobile: true },
  { href: "/projects", label: "Obras", icon: HardHat, mobile: true },
  { href: "/sales", label: "Vendas", icon: Tag, mobile: true },
  // No telemóvel a barra tem 5 lugares: Imóveis e Contactos ficam no menu do utilizador.
  { href: "/properties", label: "Imóveis", icon: Building2 },
  { href: "/contacts", label: "Contactos", icon: Users },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/settings", label: "Definições", icon: Settings },
];
