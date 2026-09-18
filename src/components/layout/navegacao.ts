import {
  Boxes,
  Car,
  ClipboardList,
  Factory,
  Hammer,
  Layers,
  LayoutDashboard,
  Network,
  Settings,
  ShoppingCart,
  Truck,
} from "lucide-react";

/**
 * O menu. Um item pode ter `filhos`, e ai vira grupo.
 *
 * Producao nasceu grupo porque as tres telas sao etapas da mesma coisa —
 * o vocabulario, a receita e a execucao. Soltas no primeiro nivel, pareciam
 * tres modulos sem relacao entre si.
 *
 * Grupo nao e link: o pai so abre e fecha. Quem leva a algum lugar e sempre
 * o filho, entao nunca ha duvida sobre onde o clique vai parar.
 */
export const NAVEGACAO = [
  { href: "/", rotulo: "Painel", Icone: LayoutDashboard, exato: true },
  { href: "/itens", rotulo: "Itens", Icone: Boxes },
  { href: "/fornecedores", rotulo: "Fornecedores", Icone: Truck },
  {
    href: "/producao",
    rotulo: "Produção",
    Icone: Factory,
    filhos: [
      { href: "/divisoes", rotulo: "Divisões", Icone: Layers },
      { href: "/estrutura", rotulo: "Estrutura", Icone: Network },
      { href: "/montagem", rotulo: "Montagem", Icone: Hammer },
    ],
  },
  { href: "/estoque", rotulo: "Estoque", Icone: ClipboardList },
  { href: "/carros", rotulo: "Carros", Icone: Car },
  { href: "/compras", rotulo: "Compras", Icone: ShoppingCart },
  { href: "/configuracoes", rotulo: "Configurações", Icone: Settings, somenteAdmin: true },
] as const;

export type ItemNavegacao = (typeof NAVEGACAO)[number];

