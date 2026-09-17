/**
 * Mascaras de digitacao.
 *
 * Existem porque `inputMode="decimal"` so troca o teclado do celular: no
 * desktop a pessoa digitava letra no campo de preco a vontade e so descobria
 * no servidor, com o valor virando zero calado. Aqui a recusa acontece na
 * propria tecla.
 *
 * Todas sao puras e recebem o texto ja alterado pelo navegador (o `value` do
 * onChange), nao a tecla — assim colar, arrastar e autocompletar passam pela
 * mesma peneira que a digitacao.
 */

const MILHAR = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Dinheiro nao aceita centavo de centavo, e 15 digitos ja e bilhao. */
const MAX_DIGITOS_MOEDA = 15;

const digitos = (texto: string) => texto.replace(/\D/g, "");

/**
 * Caixa registradora: os digitos entram pela direita e as casas decimais sao
 * sempre duas, entao a virgula nunca e digitada. Digitar 1-2-3-4-5 da
 * "123,45"; apagar volta pela direita do mesmo jeito.
 *
 * Recebe o texto exibido e devolve o par (o que mostrar, o que guardar) —
 * quem guarda fica com "1234.56", que e o que o servidor le.
 */
export function mascaraMoeda(texto: string): { exibido: string; bruto: string } {
  const centavos = digitos(texto).slice(0, MAX_DIGITOS_MOEDA).replace(/^0+(?=\d)/, "");
  if (!centavos) return { exibido: "", bruto: "" };
  const valor = Number(centavos) / 100;
  return { exibido: MILHAR.format(valor), bruto: valor.toFixed(2) };
}

/** O que guardamos ("1234.56") de volta para o que se mostra ("1.234,56"). */
export function moedaExibida(bruto: string | number | null | undefined): string {
  if (bruto === null || bruto === undefined || bruto === "") return "";
  const n = typeof bruto === "number" ? bruto : Number(String(bruto).replace(",", "."));
  return Number.isFinite(n) ? MILHAR.format(n) : "";
}

/**
 * Quantidade: digito e, quando o campo aceita fracao, uma virgula so.
 *
 * Fracao continua valendo porque a unidade manda — metro e quilo se compram
 * pela metade. Ponto vira virgula porque o teclado numerico do notebook so
 * tem ponto, e o servidor le os dois.
 */
export function mascaraNumero(texto: string, inteiro = false): string {
  const limpo = texto.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  if (inteiro) return limpo.replace(/,/g, "");
  const [inicio, ...resto] = limpo.split(",");
  return resto.length ? `${inicio},${resto.join("")}` : inicio;
}

/**
 * Telefone brasileiro, fixo ou celular. Vai formatado para o banco porque a
 * tela de fornecedores mostra o campo cru, e quem le o numero e gente — o
 * link do WhatsApp ja tira a pontuacao por conta propria.
 */
export function mascaraTelefone(texto: string): string {
  const d = digitos(texto).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
