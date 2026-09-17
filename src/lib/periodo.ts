/**
 * Mes de referencia dos filtros de periodo.
 *
 * O mes anda sempre no fuso de Sao Paulo, nao no do servidor. `criadoEm` e
 * `timestamptz`, entao o instante esta certo no banco; o que erra e a
 * fronteira: na Vercel o processo roda em UTC, e um lancamento das 22h do
 * dia 30 cairia no mes seguinte. Quem digita esta no Brasil e espera ver
 * aquele lancamento em setembro.
 *
 * O recorte em si fica no SQL (`AT TIME ZONE`), que sabe o historico de
 * horario de verao — daqui sai so a data limite, em texto.
 */

export const FUSO = "America/Sao_Paulo";

/** "2026-09" — o formato que anda na URL. */
const FORMATO = /^\d{4}-(0[1-9]|1[0-2])$/;

const PARTES = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
});

const NOMES = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** O mes em que um instante cai, visto do Brasil. */
export function mesDe(quando: Date): string {
  const p = Object.fromEntries(
    PARTES.formatToParts(quando).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}`;
}

/** Descarta o que veio torto da URL em vez de filtrar por lixo. */
export function mesValido(valor: string | undefined): string | undefined {
  return valor && FORMATO.test(valor) ? valor : undefined;
}

/**
 * A primeira data do mes e a do mes seguinte. O filtro usa `>= inicio` e
 * `< fim`: com `<= ultimo dia` os lancamentos do proprio dia 31 ficariam de
 * fora, porque a comparacao inclui a hora.
 */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split("-").map(Number);
  const seguinte = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
  return { inicio: `${mes}-01`, fim: `${seguinte}-01` };
}

/** "2026-09" → "Setembro de 2026". */
export function rotuloMes(mes: string): string {
  /* Meio-dia em UTC: a data nua viraria o dia anterior em qualquer fuso
     negativo, e o rotulo sairia com o mes errado. */
  const texto = NOMES.format(new Date(`${mes}-15T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Do mes mais antigo com dado ate o mes corrente, do mais novo para o mais
 * velho. Sai da propria base para a lista nao oferecer mes vazio.
 */
export function mesesAte(maisAntigo: Date | null, agora = new Date()): string[] {
  const fim = mesDe(agora);
  if (!maisAntigo) return [fim];

  const lista: string[] = [];
  let [ano, m] = mesDe(maisAntigo).split("-").map(Number);
  const [anoFim, mFim] = fim.split("-").map(Number);

  while (ano < anoFim || (ano === anoFim && m <= mFim)) {
    lista.push(`${ano}-${String(m).padStart(2, "0")}`);
    if (m === 12) {
      ano += 1;
      m = 1;
    } else {
      m += 1;
    }
  }
  return lista.reverse();
}
