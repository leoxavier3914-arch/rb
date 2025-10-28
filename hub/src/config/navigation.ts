import type { ComponentType, SVGProps } from "react";
import { LayoutDashboard, LineChart, Settings } from "lucide-react";

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Vendas", href: "/sales", icon: LineChart },
  { label: "Configurações", href: "/configs", icon: Settings }
];

export function resolveNavTitle(pathname: string): string {
  const match = NAV_ITEMS.find(item => pathname.startsWith(item.href));
  return match ? match.label : "Hub";
}
