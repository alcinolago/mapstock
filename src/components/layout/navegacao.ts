import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Network,
  Settings,
  ShoppingCart,
  Truck,
} from "lucide-react";

export const NAVEGACAO = [
  { href: "/", rotulo: "Painel", Icone: LayoutDashboard, exato: true },
  { href: "/itens", rotulo: "Itens", Icone: Boxes },
  { href: "/fornecedores", rotulo: "Fornecedores", Icone: Truck },
  { href: "/estrutura", rotulo: "Estrutura", Icone: Network },
  { href: "/estoque", rotulo: "Estoque", Icone: ClipboardList },
  { href: "/compras", rotulo: "Compras", Icone: ShoppingCart },
  { href: "/configuracoes", rotulo: "Configurações", Icone: Settings, somenteAdmin: true },
] as const;
