import {
  Boxes,
  ClipboardList,
  Factory,
  Hammer,
  History,
  Layers,
  LayoutDashboard,
  Network,
  Package,
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
 * Carros saiu: rastrear qual equipamento esta em qual veiculo e controle de
 * ativo instalado, nao de estoque, e estava arrastando o sistema para longe
 * do que ele serve.
 *
 * Estoque virou grupo por um mal-entendido que custava tempo: quem queria
 * ver o que tem na prateleira clicava em "Estoque" e caia no historico de
 * movimentacoes, que e a unica tela que nao mostra saldo. Agora o pai e a
 * secao, e os filhos dizem o que sao — Itens tem o saldo, Movimentacoes tem
 * o historico.
 *
 * Grupo nao e link: o pai so abre e fecha. Quem leva a algum lugar e sempre
 * o filho, entao nunca ha duvida sobre onde o clique vai parar.
 */
export const NAVEGACAO = [
  { href: "/", rotulo: "Painel", Icone: LayoutDashboard, exato: true },
  {
    href: "/estoque-geral",
    rotulo: "Estoque",
    Icone: Boxes,
    filhos: [
      { href: "/itens", rotulo: "Itens", Icone: Package },
      { href: "/estoque", rotulo: "Movimentações", Icone: ClipboardList },
    ],
  },
  { href: "/fornecedores", rotulo: "Fornecedores", Icone: Truck },
  {
    href: "/producao",
    rotulo: "Produção",
    Icone: Factory,
    filhos: [
      { href: "/divisoes", rotulo: "Divisões", Icone: Layers },
      { href: "/estrutura", rotulo: "Estrutura", Icone: Network },
      /* `exato` porque o histórico mora abaixo dela: sem isso as duas
         acendiam juntas na barra. */
      { href: "/montagem", rotulo: "Montagem", Icone: Hammer, exato: true },
      { href: "/montagem/historico", rotulo: "Histórico", Icone: History },
    ],
  },
  { href: "/compras", rotulo: "Compras", Icone: ShoppingCart },
  { href: "/configuracoes", rotulo: "Configurações", Icone: Settings, somenteAdmin: true },
] as const;

export type ItemNavegacao = (typeof NAVEGACAO)[number];

