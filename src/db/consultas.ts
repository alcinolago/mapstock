import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "./index";
import {
  classificacoes,
  cotacoes,
  itens,
  movimentos,
  pedidosCompra,
  unidades,
  usuarios,
} from "./schema";

/**
 * Saldo por item, agregado no banco.
 *
 * No desktop, filter_summary() rodava uma consulta de movimentos por item
 * dentro do laco (N+1). Aqui e um GROUP BY so, e o CASE espelha exatamente o
 * EFEITO_MOVIMENTO de src/lib/labels.ts — se um tipo novo aparecer, os dois
 * precisam mudar juntos.
 */
export const saldos = db
  .select({
    itemId: movimentos.itemId,
    fisico: sql<number>`coalesce(sum(case
      when ${movimentos.tipo} in ('entrada_compra','entrada_fabricacao','ajuste_positivo') then ${movimentos.quantidade}
      when ${movimentos.tipo} in ('saida_producao','ajuste_negativo') then -${movimentos.quantidade}
      else 0 end), 0)::float8`.as("fisico"),
    reservado: sql<number>`coalesce(sum(case
      when ${movimentos.tipo} = 'reserva' then ${movimentos.quantidade}
      when ${movimentos.tipo} = 'liberacao_reserva' then -${movimentos.quantidade}
      else 0 end), 0)::float8`.as("reservado"),
  })
  .from(movimentos)
  .groupBy(movimentos.itemId)
  .as("saldos");

export type SituacaoItem = "ok" | "falta" | "abaixo_minimo" | "nao_estocavel";

export type ItemComSaldo = {
  id: string;
  codigo: string;
  descricao: string;
  classificacao: string;
  unidade: string;
  nivel: number;
  custoUnitario: number;
  estoqueMinimo: number;
  localizacao: string | null;
  ativo: boolean;
  fisico: number;
  reservado: number;
  disponivel: number;
  valorEstoque: number;
  situacao: SituacaoItem;
};

/**
 * Nivel 0 e o equipamento montado: nao se compra nem se estoca, entao nunca
 * conta como falta. Mesma decisao do desktop, so que agora explicita.
 */
export function situacaoDoItem(
  nivel: number,
  disponivel: number,
  estoqueMinimo: number,
): SituacaoItem {
  if (nivel === 0) return "nao_estocavel";
  if (disponivel <= 0) return "falta";
  if (estoqueMinimo > 0 && disponivel < estoqueMinimo) return "abaixo_minimo";
  return "ok";
}

export async function listarItensComSaldo(filtros?: {
  busca?: string;
  classificacaoId?: string;
  nivel?: number;
  situacao?: SituacaoItem;
  incluirInativos?: boolean;
}): Promise<ItemComSaldo[]> {
  const condicoes: SQL[] = [];

  if (!filtros?.incluirInativos) condicoes.push(eq(itens.ativo, true));
  if (filtros?.classificacaoId) {
    condicoes.push(eq(itens.classificacaoId, filtros.classificacaoId));
  }
  if (filtros?.nivel !== undefined) condicoes.push(eq(itens.nivel, filtros.nivel));
  if (filtros?.busca) {
    const t = `%${filtros.busca}%`;
    condicoes.push(
      or(
        ilike(itens.codigo, t),
        ilike(itens.descricao, t),
        ilike(itens.localizacao, t),
      ) as SQL,
    );
  }

  const linhas = await db
    .select({
      id: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      classificacao: classificacoes.nome,
      unidade: unidades.sigla,
      nivel: itens.nivel,
      custoUnitario: itens.custoUnitario,
      estoqueMinimo: itens.estoqueMinimo,
      localizacao: itens.localizacao,
      ativo: itens.ativo,
      fisico: sql<number>`coalesce(${saldos.fisico}, 0)`,
      reservado: sql<number>`coalesce(${saldos.reservado}, 0)`,
    })
    .from(itens)
    .innerJoin(classificacoes, eq(classificacoes.id, itens.classificacaoId))
    .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(saldos, eq(saldos.itemId, itens.id))
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(asc(itens.nivel), asc(itens.codigo));

  const comSaldo = linhas.map((l) => {
    const disponivel = l.fisico - l.reservado;
    return {
      ...l,
      disponivel,
      valorEstoque: l.fisico * l.custoUnitario,
      situacao: situacaoDoItem(l.nivel, disponivel, l.estoqueMinimo),
    };
  });

  return filtros?.situacao
    ? comSaldo.filter((i) => i.situacao === filtros.situacao)
    : comSaldo;
}

export async function saldoDoItem(itemId: string) {
  const [linha] = await db
    .select({ fisico: saldos.fisico, reservado: saldos.reservado })
    .from(saldos)
    .where(eq(saldos.itemId, itemId));
  const fisico = linha?.fisico ?? 0;
  const reservado = linha?.reservado ?? 0;
  return { fisico, reservado, disponivel: fisico - reservado };
}

export async function ultimosMovimentos(limite = 8) {
  return db
    .select({
      id: movimentos.id,
      tipo: movimentos.tipo,
      quantidade: movimentos.quantidade,
      criadoEm: movimentos.criadoEm,
      referencia: movimentos.referencia,
      codigo: itens.codigo,
      descricao: itens.descricao,
      unidade: unidades.sigla,
      usuario: usuarios.nome,
    })
    .from(movimentos)
    .innerJoin(itens, eq(itens.id, movimentos.itemId))
    .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(usuarios, eq(usuarios.id, movimentos.usuarioId))
    .orderBy(desc(movimentos.criadoEm))
    .limit(limite);
}

/** Numeros do painel, numa ida so ao banco por assunto. */
export async function resumoPainel() {
  const lista = await listarItensComSaldo();

  const [{ pedidosAbertos }] = await db
    .select({ pedidosAbertos: sql<number>`count(*)::int` })
    .from(pedidosCompra)
    .where(inArray(pedidosCompra.status, ["aberto", "parcial"]));

  const [{ cotacoesAbertas }] = await db
    .select({ cotacoesAbertas: sql<number>`count(*)::int` })
    .from(cotacoes)
    .where(inArray(cotacoes.status, ["rascunho", "enviada", "respondida"]));

  return {
    totalItens: lista.length,
    emFalta: lista.filter((i) => i.situacao === "falta").length,
    abaixoMinimo: lista.filter((i) => i.situacao === "abaixo_minimo").length,
    comReserva: lista.filter((i) => i.reservado > 0).length,
    valorEstoque: lista.reduce((s, i) => s + i.valorEstoque, 0),
    pedidosAbertos,
    cotacoesAbertas,
    atencao: lista
      .filter((i) => i.situacao === "falta" || i.situacao === "abaixo_minimo")
      .slice(0, 8),
  };
}
