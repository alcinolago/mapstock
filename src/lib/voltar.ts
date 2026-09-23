/**
 * De onde a pessoa veio, para o "voltar" devolver ao lugar certo.
 *
 * O cadastro de item e aberto de muitos lugares — da cotacao, do pedido, do
 * historico, da arvore de montagem — e o link de voltar era fixo em
 * "Voltar para itens". Quem estava no meio de uma cotacao clicava em "abrir
 * cadastro do item", resolvia o que precisava, voltava e caia na lista de
 * itens: perdia a cotacao, os filtros e a pagina em que estava.
 *
 * Anda na URL, e nao no historico do navegador (`router.back()`), pelo mesmo
 * motivo dos filtros: recarregar a pagina, abrir noutra aba ou mandar o link
 * continuam funcionando. `back()` tambem erraria depois de salvar, quando a
 * navegacao ja empilhou outra entrada.
 */

export type Volta = { href: string; rotulo: string };

export const VOLTA_PADRAO: Volta = { href: "/itens", rotulo: "Voltar para itens" };

/**
 * O rotulo sai daqui, e nao da URL: mandar o texto junto deixaria qualquer
 * um escrever o que quisesse no link de uma pagina nossa.
 */
const ROTULOS: [RegExp, string][] = [
  [/^\/compras\/cotacoes\/[^/]+$/, "Voltar para a cotação"],
  [/^\/compras\/cotacoes$/, "Voltar para cotações"],
  [/^\/compras\/pedidos\/[^/]+$/, "Voltar para o pedido"],
  [/^\/compras\/pedidos$/, "Voltar para pedidos"],
  [/^\/estoque$/, "Voltar para movimentações"],
  [/^\/fornecedores\/[^/]+$/, "Voltar para o fornecedor"],
  [/^\/montagem$/, "Voltar para montagem"],
  [/^\/estrutura$/, "Voltar para a estrutura"],
  [/^\/conjuntos$/, "Voltar para conjuntos"],
  [/^\/$/, "Voltar para o painel"],
];

/** Le o `volta` da URL e devolve para onde ir e o que escrever no link. */
export function voltarPara(volta: string | undefined): Volta {
  if (!volta) return VOLTA_PADRAO;

  /* So caminho interno. `//outro.site` e `https://...` sao endereco de fora, e
     um link nosso que leva para fora e justamente o que um redirecionamento
     aberto explora. */
  if (!volta.startsWith("/") || volta.startsWith("//")) return VOLTA_PADRAO;

  const caminho = volta.split("?")[0];
  const rotulo = ROTULOS.find(([padrao]) => padrao.test(caminho))?.[1];

  /* Caminho interno que ninguem reconhece cai no padrao: melhor voltar para
     itens do que oferecer "Voltar" para um lugar sem nome. */
  return rotulo ? { href: volta, rotulo } : VOLTA_PADRAO;
}

/**
 * O link para o cadastro de um item, carregando de onde se saiu.
 *
 * `de` vai inteiro, com a query: voltar para `/estoque?pagina=3&item=X` tem
 * de cair na pagina 3 com o filtro, e nao no topo do historico.
 */
export function linkDoItem(itemId: string, de: string): string {
  return `/itens/${itemId}?volta=${encodeURIComponent(de)}`;
}
