/**
 * Rotulos em portugues para as chaves ASCII gravadas no banco.
 *
 * O banco nunca guarda texto acentuado em campo de enum. Essa separacao
 * existe por causa do bug critico nº 1 do sistema desktop, onde o codigo
 * comparava "Entrada fabricacao" (sem acento, escrito a mao) com
 * "Entrada fabricação" (com acento, gravado no banco) e os movimentos
 * simplesmente desapareciam do calculo de saldo.
 */

import type {
  acaoAuditoria,
  origemFabricacao,
  papelUsuario,
  statusCotacao,
  statusFornecedor,
  statusMontagem,
  statusPedido,
  tipoAquisicao,
  tipoMovimento,
  tipoVersao,
  unidadePrazo,
} from "@/db/schema";

type Valor<T extends { enumValues: readonly string[] }> = T["enumValues"][number];

export type TipoMovimento = Valor<typeof tipoMovimento>;
export type TipoAquisicao = Valor<typeof tipoAquisicao>;
export type OrigemFabricacao = Valor<typeof origemFabricacao>;
export type StatusFornecedor = Valor<typeof statusFornecedor>;
export type StatusCotacao = Valor<typeof statusCotacao>;
export type StatusPedido = Valor<typeof statusPedido>;
export type StatusMontagem = Valor<typeof statusMontagem>;
export type TipoVersao = Valor<typeof tipoVersao>;
export type PapelUsuario = Valor<typeof papelUsuario>;
export type UnidadePrazo = Valor<typeof unidadePrazo>;
export type AcaoAuditoria = Valor<typeof acaoAuditoria>;

export const MOVIMENTOS: Record<TipoMovimento, string> = {
  entrada_compra: "Entrada compra",
  entrada_fabricacao: "Entrada fabricação",
  saida_producao: "Saída produção",
  reserva: "Reserva",
  liberacao_reserva: "Liberação reserva",
  ajuste_positivo: "Ajuste positivo",
  ajuste_negativo: "Ajuste negativo",
  devolucao_compra: "Devolução compra",
};

/** Como cada tipo de movimento afeta o saldo. Fonte unica da verdade. */
export const EFEITO_MOVIMENTO: Record<
  TipoMovimento,
  { fisico: 1 | -1 | 0; reservado: 1 | -1 | 0 }
> = {
  entrada_compra: { fisico: 1, reservado: 0 },
  entrada_fabricacao: { fisico: 1, reservado: 0 },
  ajuste_positivo: { fisico: 1, reservado: 0 },
  saida_producao: { fisico: -1, reservado: 0 },
  ajuste_negativo: { fisico: -1, reservado: 0 },
  devolucao_compra: { fisico: -1, reservado: 0 },
  reserva: { fisico: 0, reservado: 1 },
  liberacao_reserva: { fisico: 0, reservado: -1 },
};

/**
 * Movimento nao se apaga: lanca-se o oposto. Mora aqui junto do EFEITO
 * porque quem estorna precisa da mesma regra em mais de um lugar — a tela de
 * estoque e a desmontagem de uma estrutura.
 */
export const OPOSTO_MOVIMENTO: Record<TipoMovimento, TipoMovimento> = {
  entrada_compra: "ajuste_negativo",
  entrada_fabricacao: "ajuste_negativo",
  ajuste_positivo: "ajuste_negativo",
  saida_producao: "ajuste_positivo",
  ajuste_negativo: "ajuste_positivo",
  /* Estornar uma devolucao e receber de volta: a mercadoria retorna. */
  devolucao_compra: "entrada_compra",
  reserva: "liberacao_reserva",
  liberacao_reserva: "reserva",
};

export const AQUISICOES: Record<TipoAquisicao, string> = {
  compra_nacional: "Compra nacional",
  compra_importada: "Compra importada",
  fabricacao_interna: "Fabricação interna",
  sob_encomenda: "Sob encomenda",
};

export const ORIGENS: Record<OrigemFabricacao, string> = {
  interna_impressao_3d: "Interna — Impressão 3D",
  interna_usinagem: "Interna — Usinagem",
  interna_montagem: "Interna — Montagem",
  terceiro_impressao_3d: "Terceiro — Impressão 3D",
  terceiro_usinagem: "Terceiro — Usinagem",
  terceiro_corte_dobra: "Terceiro — Corte/Dobra",
  compra_pronta_nacional: "Compra pronta nacional",
  compra_importada: "Compra importada",
};

/** Origens que liberam o bloco de parametros de impressao 3D no formulario. */
export const ORIGENS_3D: OrigemFabricacao[] = [
  "interna_impressao_3d",
  "terceiro_impressao_3d",
];

export const STATUS_FORNECEDOR: Record<StatusFornecedor, string> = {
  preferencial: "Preferencial",
  aprovado: "Aprovado",
  em_avaliacao: "Em avaliação",
  emergencia: "Emergência",
  bloqueado: "Bloqueado",
};

export const STATUS_COTACAO: Record<StatusCotacao, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  respondida: "Respondida",
  fechada: "Fechada",
  cancelada: "Cancelada",
};

export const STATUS_PEDIDO: Record<StatusPedido, string> = {
  aberto: "Aberto",
  parcial: "Recebido parcial",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

export const STATUS_MONTAGEM: Record<StatusMontagem, string> = {
  em_montagem: "Em montagem",
  montada: "Montada, pronta",
  instalada: "Instalada em carro",
  desmontada: "Desmontada",
};

export const TIPOS_VERSAO: Record<TipoVersao, string> = {
  sistema: "Sistema do PC",
  tablet: "App do tablet",
};

export const PAPEIS: Record<PapelUsuario, string> = {
  admin: "Administrador",
  editor: "Editor",
  leitura: "Somente leitura",
};

export const UNIDADES_PRAZO: Record<UnidadePrazo, string> = {
  horas: "horas",
  dias: "dias",
};

export const ACOES_AUDITORIA: Record<AcaoAuditoria, string> = {
  criar: "Criou",
  atualizar: "Alterou",
  excluir: "Excluiu",
};

/** Transforma um Record de rotulos na lista que os <Select> consomem. */
export function opcoes<T extends string>(mapa: Record<T, string>) {
  return (Object.entries(mapa) as [T, string][]).map(([valor, rotulo]) => ({
    valor,
    rotulo,
  }));
}

export const MATERIAIS_3D = [
  "ABS", "PLA", "PETG", "TPU", "TPE", "ASA", "Nylon", "PA", "PA6", "PA12",
  "PA-GF", "PA-CF", "PC", "PC-ABS", "POM", "PP", "HIPS", "PVA", "BVOH", "PET",
  "PEEK", "PEI", "ULTEM", "Resina standard", "Resina tough", "Resina flexível",
  "Resina lavável em água", "Outro",
];
