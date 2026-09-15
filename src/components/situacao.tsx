import { Selo, type TomSelo } from "@/components/ui/selo";
import type { SituacaoItem } from "@/db/consultas";
import { MOVIMENTOS, STATUS_COTACAO, STATUS_PEDIDO, type StatusCotacao, type StatusPedido, type TipoMovimento } from "@/lib/labels";

const SITUACAO: Record<SituacaoItem, { rotulo: string; tom: TomSelo }> = {
  ok: { rotulo: "OK", tom: "ok" },
  falta: { rotulo: "Em falta", tom: "perigo" },
  abaixo_minimo: { rotulo: "Abaixo do mínimo", tom: "alerta" },
  nao_estocavel: { rotulo: "Não estocável", tom: "neutro" },
};

export function SeloSituacao({ situacao }: { situacao: SituacaoItem }) {
  const { rotulo, tom } = SITUACAO[situacao];
  return <Selo tom={tom}>{rotulo}</Selo>;
}

/** Entradas em verde, saidas em vermelho, reservas em ambar. */
const TOM_MOVIMENTO: Record<TipoMovimento, TomSelo> = {
  entrada_compra: "ok",
  entrada_fabricacao: "ok",
  ajuste_positivo: "ok",
  saida_producao: "perigo",
  ajuste_negativo: "perigo",
  reserva: "alerta",
  liberacao_reserva: "info",
};

export function SeloMovimento({ tipo }: { tipo: TipoMovimento }) {
  return <Selo tom={TOM_MOVIMENTO[tipo]}>{MOVIMENTOS[tipo]}</Selo>;
}

const TOM_PEDIDO: Record<StatusPedido, TomSelo> = {
  aberto: "info",
  parcial: "alerta",
  recebido: "ok",
  cancelado: "neutro",
};

export function SeloPedido({ status }: { status: StatusPedido }) {
  return <Selo tom={TOM_PEDIDO[status]}>{STATUS_PEDIDO[status]}</Selo>;
}

const TOM_COTACAO: Record<StatusCotacao, TomSelo> = {
  rascunho: "neutro",
  enviada: "info",
  respondida: "marca",
  fechada: "ok",
  cancelada: "neutro",
};

export function SeloCotacao({ status }: { status: StatusCotacao }) {
  return <Selo tom={TOM_COTACAO[status]}>{STATUS_COTACAO[status]}</Selo>;
}
