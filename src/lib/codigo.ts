/**
 * Classificacao automatica pela descricao.
 *
 * Porte das funcoes norm() e classify() do MPZ-ERP-V35.pyw (linhas 199 e
 * 629). A terceira, code_suggestion(), montava o codigo a partir de palavras
 * da descricao (PARAFUSO -> PAR, M6x20 -> M6X20) e foi removida: o
 * vocabulario dela era curto demais para o catalogo real, entao a maioria
 * das pecas caia no prefixo sozinho e o cadastro ficou com meia duzia de
 * padroes convivendo. Hoje o codigo e prefixo da classificacao mais um
 * sequencial, montado em `acoes/itens.ts`.
 */

/** Maiusculas, sem acento, so letras/numeros separados por espaco. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .toUpperCase()
    .trim();
}

/**
 * Primeira classificacao cujas palavras-chave aparecem na descricao.
 * As regras vem do banco (tabela regras_classificacao), entao ele consegue
 * criar as proprias sem mexer em codigo.
 */
export function classificarPorRegras(
  descricao: string,
  regras: { classificacaoId: string; palavraChave: string }[],
): string | null {
  const d = normalizar(descricao);
  return regras.find((r) => d.includes(normalizar(r.palavraChave)))?.classificacaoId ?? null;
}
