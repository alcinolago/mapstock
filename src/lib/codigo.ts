/**
 * Sugestao automatica de codigo e de classificacao.
 *
 * Porte direto das funcoes norm(), classify() e code_suggestion() do
 * MPZ-ERP-V35.pyw (linhas 199, 629 e 634). E regra de negocio de verdade,
 * construida por quem conhece as pecas, entao vem junto quase sem mudanca.
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
 * Sufixo de tipo dentro do codigo: PARAFUSO -> PAR, PORCA -> POR.
 *
 * Diferenca proposital em relacao ao desktop: la o valor padrao era "EST",
 * o que gerava codigo redundante como "EST-EST-..." para qualquer item
 * estrutural generico. Aqui, sem palavra reconhecida, o trecho fica de fora.
 */
const TIPOS: [string, string][] = [
  ["PARAFUSO", "PAR"],
  ["PORCA", "POR"],
  ["ARRUELA", "ARR"],
  ["FILAMENTO", "FIL"],
  ["SUPORTE", "SUP"],
  ["CAMERA", "CAM"],
];

/** Materiais reconhecidos na descricao, do mais especifico pro mais generico. */
const MATERIAIS: [(d: string) => boolean, string][] = [
  [(d) => d.includes("PA6") && d.includes("GF"), "PA6GF"],
  [(d) => d.includes("PA12"), "PA12"],
  [(d) => d.includes("PETG"), "PETG"],
  [(d) => d.includes("ABS"), "ABS"],
  [(d) => d.includes("PLA"), "PLA"],
];

/** Medida no padrao M6x20, M 8 X 30 etc. */
const MEDIDA = /\bM\s*\d+\s*[Xx]\s*\d+\b/;

/**
 * Monta o codigo base a partir da descricao e do prefixo da classificacao.
 * Ex.: ("PARAFUSO M6X20 INOX", "FIX") -> "FIX-PAR-M6X20"
 */
export function codigoBase(descricao: string, prefixoClassificacao: string): string {
  const d = normalizar(descricao);

  const tipo = TIPOS.find(([palavra]) => d.includes(palavra))?.[1] ?? "";
  const medida = MEDIDA.exec(d)?.[0].replace(/\s+/g, "").toUpperCase() ?? "";
  const material = MATERIAIS.find(([testa]) => testa(d))?.[1] ?? "";

  const partes = [prefixoClassificacao, tipo, medida, material].filter(Boolean);
  return partes.length > 0 ? partes.join("-") : "ITM";
}

/**
 * Acrescenta sufixo numerico enquanto o codigo ja existir:
 * FIX-PAR-M6X20 -> FIX-PAR-M6X20-01 -> FIX-PAR-M6X20-02
 */
export function codigoDisponivel(base: string, existentes: Set<string>): string {
  if (!existentes.has(base)) return base;
  let n = 1;
  let candidato = `${base}-${String(n).padStart(2, "0")}`;
  while (existentes.has(candidato)) {
    n += 1;
    candidato = `${base}-${String(n).padStart(2, "0")}`;
  }
  return candidato;
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
