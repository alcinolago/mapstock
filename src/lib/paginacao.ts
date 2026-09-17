/**
 * Paginacao pela URL.
 *
 * Vai na URL e nao em estado da tela para recarregar, voltar de um item e
 * mandar o link caírem todos na mesma pagina — numa conferencia, "estava na
 * pagina 7" precisa sobreviver a abrir um item e voltar.
 */

export const POR_PAGINA = [25, 50, 100, 200] as const;
export const POR_PAGINA_PADRAO = 50;

export type Paginacao = {
  pagina: number;
  porPagina: number;
  /** Quantos pular na consulta. */
  pular: number;
};

/** Le e conserta o que veio da URL: pagina 0, negativa ou "abc" viram 1. */
export function lerPaginacao(
  pagina: string | undefined,
  porPagina: string | undefined,
): Paginacao {
  const n = Number(porPagina);
  const tamanho = (POR_PAGINA as readonly number[]).includes(n) ? n : POR_PAGINA_PADRAO;
  const p = Math.max(1, Math.trunc(Number(pagina)) || 1);
  return { pagina: p, porPagina: tamanho, pular: (p - 1) * tamanho };
}

/**
 * A pagina pedida, presa ao que existe.
 *
 * Filtrar costuma encolher a lista com a pessoa parada numa pagina alta, e
 * ai a tela viria vazia sem explicacao — melhor cair na ultima que existe.
 */
export function paginaValida(pedida: number, total: number, porPagina: number): number {
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  return Math.min(pedida, ultima);
}

/**
 * Os numeros a mostrar: sempre a primeira, a ultima, a atual e uma vizinha de
 * cada lado. `null` e onde entra o "…" — com 300 paginas, imprimir todas
 * empurraria a tabela para fora da tela.
 */
export function numerosDePagina(atual: number, ultima: number): (number | null)[] {
  if (ultima <= 7) return Array.from({ length: ultima }, (_, i) => i + 1);

  const perto = new Set([1, ultima, atual, atual - 1, atual + 1]);
  const lista: (number | null)[] = [];
  let vazio = false;

  for (let p = 1; p <= ultima; p++) {
    if (perto.has(p)) {
      lista.push(p);
      vazio = false;
    } else if (!vazio) {
      lista.push(null);
      vazio = true;
    }
  }
  return lista;
}
