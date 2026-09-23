import { listarMoldes, nosDoMolde, type NoDoMolde } from "@/db/consultas";
import type { NoMolde } from "@/components/moldes/arvore-molde";
import type { MoldeNaTela } from "@/components/moldes/painel-moldes";

/*
 * Fora da pagina porque o PDF da estrutura precisa da mesma arvore, com os
 * mesmos conjuntos abertos e o mesmo custo. Duas montagens da arvore sao
 * como a folha impressa passa a discordar da tela.
 */

/**
 * Monta a arvore de um molde, abrindo os conjuntos que aparecem dentro dela.
 *
 * O equipamento e um manual: ele aponta para o item "Domo", e quem diz o que
 * tem dentro de um domo e a estrutura do domo, na secao Itens. Sem abrir essa
 * arvore, o manual mostra uma linha unica e nao serve para quem esta na
 * bancada querendo ver o equipamento inteiro ate o ultimo parafuso.
 *
 * O que vem de dentro do conjunto vai marcado com `doConjunto`, e a tela nao oferece
 * botao nenhum nessas linhas. A alteracao e sempre na estrutura do proprio
 * item — editar por dois lugares e como um deles fica errado.
 *
 * As quantidades sao as da receita do conjunto, sem multiplicar pela quantidade do
 * pai: o bloco e copia fiel do que esta na secao Itens, que e para onde a
 * pessoa vai quando quiser mudar. Multiplicar faria os dois discordarem.
 *
 * O custo sobe junto: um conjunto nunca foi comprado, entao o preco dele e zero e
 * o equipamento somaria o domo como nada. Com a arvore aberta, o no do conjunto
 * passa a valer a soma do que entra nele.
 */
function emArvore(
  moldeId: string,
  paiId: string | null,
  planas: Map<string, NoDoMolde[]>,
  conjuntos: Map<string, string>,
  doConjunto: boolean,
  /* Conjunto dentro de conjunto e normal; conjunto dentro de si mesmo nao deveria existir,
     mas dado antigo nao pode travar a tela num laco infinito. */
  visitados: Set<string>,
): NoMolde[] {
  return (planas.get(moldeId) ?? [])
    .filter((n) => n.paiId === paiId)
    .map((n) => {
      const moldeDoConjunto = n.itemId ? conjuntos.get(n.itemId) : undefined;
      const abreConjunto = Boolean(moldeDoConjunto && !visitados.has(moldeDoConjunto));

      const filhos = abreConjunto
        ? emArvore(moldeDoConjunto!, null, planas, conjuntos, true, new Set(visitados).add(moldeDoConjunto!))
        : emArvore(moldeId, n.id, planas, conjuntos, doConjunto, visitados);

      /* Peca folha vale o proprio custo; divisao e conjunto valem o que esta
         dentro deles. */
      const proprio = n.itemId && filhos.length === 0 ? n.custo * n.quantidade : 0;
      const dosFilhos = filhos.reduce((t, f) => t + f.custoTotal, 0);

      return {
        id: n.id,
        nome: n.nome,
        itemId: n.itemId,
        codigo: n.codigo,
        descricao: n.descricao,
        unidade: n.unidade,
        quantidade: n.quantidade,
        localMontagem: n.localMontagem,
        disponivel: n.disponivel,
        custoTotal: proprio + dosFilhos * n.quantidade,
        ehConjunto: Boolean(moldeDoConjunto),
        doConjunto,
        filhos,
      };
    });
}

/** Todas as estruturas, cada uma com a arvore montada e os conjuntos abertos. */
export async function listarEstruturas(): Promise<MoldeNaTela[]> {
  const lista = await listarMoldes();

  /* Todas as arvores de uma vez: a expansao de um conjunto precisa da arvore de
     outro molde, entao buscar sob demanda dentro da recursao viraria uma ida
     ao banco por no. Sao poucos moldes. */
  const planas = new Map<string, NoDoMolde[]>(
    await Promise.all(lista.map(async (m) => [m.id, await nosDoMolde(m.id)] as const)),
  );

  /* item -> estrutura que o produz. E este mapa que faz o manual reconhecer
     que aquela linha nao e uma peca qualquer, e sim um conjunto com receita. */
  const conjuntos = new Map(
    lista.filter((m) => m.itemId).map((m) => [m.itemId!, m.id] as const),
  );

  return lista.map((m) => {
    const nos = emArvore(m.id, null, planas, conjuntos, false, new Set([m.id]));
    return {
      id: m.id,
      nome: m.nome,
      descricao: m.descricao,
      ativo: m.ativo,
      emMontagem: m.emMontagem,
      itemId: m.itemId,
      codigo: m.codigo,
      itemDescricao: m.itemDescricao,
      unidade: m.unidade,
      emEstoque: m.emEstoque,
      custoTotal: nos.reduce((t, n) => t + n.custoTotal, 0),
      nos,
    };
  });
}

