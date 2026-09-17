/**
 * Vocabulário comum entre as actions que excluem e o diálogo que pergunta
 * antes. Mora aqui, e não junto da action, porque arquivo "use server" só
 * pode exportar função async — tipo e helper de texto não cabem lá.
 *
 * A ideia: excluir só trava no que é documento (cotação, pedido, montagem,
 * estrutura). O resto — movimentação avulsa, vínculo de preço — vai junto e
 * a pessoa vê quanto é antes de confirmar.
 */

export type Contagem = { rotulo: string; quantidade: number };

export type Dependencias = {
  /** O que impede a exclusão. Vazio significa que dá para excluir. */
  bloqueios: Contagem[];
  /** O que some junto se a exclusão acontecer. */
  junto: Contagem[];
};

/** Descarta as linhas zeradas e resolve o plural de cada uma. */
export function contagens(
  entradas: { quantidade: number; singular: string; plural: string }[],
): Contagem[] {
  return entradas
    .filter((e) => e.quantidade > 0)
    .map((e) => ({
      rotulo: e.quantidade === 1 ? e.singular : e.plural,
      quantidade: e.quantidade,
    }));
}

/** "2 pedidos de compra e 1 montagem" — para caber no meio de uma frase. */
export function emTexto(lista: Contagem[]): string {
  const partes = lista.map((c) => `${c.quantidade} ${c.rotulo}`);
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}
