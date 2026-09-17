import { and, asc, desc, eq, ilike, inArray, isNull, not, or, sql, type SQL } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";

import { diaSeguinte, FUSO, limitesDoMes } from "@/lib/periodo";

import { db } from "./index";
import {
  bom,
  carros,
  classificacoes,
  cotacoes,
  fornecedores,
  itemFornecedores,
  itens,
  locais,
  itensParametros3d,
  montagens,
  movimentos,
  pedidoItens,
  pedidosCompra,
  unidades,
  usuarios,
  versoes,
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
      when ${movimentos.tipo} in ('saida_producao','ajuste_negativo','devolucao_compra') then -${movimentos.quantidade}
      else 0 end), 0)::float8`.as("fisico"),
    reservado: sql<number>`coalesce(sum(case
      when ${movimentos.tipo} = 'reserva' then ${movimentos.quantidade}
      when ${movimentos.tipo} = 'liberacao_reserva' then -${movimentos.quantidade}
      else 0 end), 0)::float8`.as("reservado"),
  })
  .from(movimentos)
  .groupBy(movimentos.itemId)
  .as("saldos");

/**
 * O custo do item, vindo do preco da ultima compra recebida.
 *
 * Isto e a fonte do custo, e nao `itens.custoUnitario`. Aquele campo e
 * gravado pelo recebimento e ficava sozinho com a verdade, entao bastava um
 * caminho que criasse movimento sem passar por `receberItemDoPedido` para
 * ele parar no tempo — foi o que aconteceu com dado semeado, que mostrava
 * custo zero num item comprado a 465. Derivar apaga essa classe de erro em
 * vez de corrigir caso a caso.
 *
 * `pedidoItens.precoUnitario` nao e sobrescrito, e o movimento de
 * recebimento aponta para a linha do pedido.
 *
 * So `entrada_compra`: devolucao tambem carrega `pedidoItemId`, e devolver
 * nao redefine custo nenhum.
 */
function custoDoUltimoRecebimento() {
  return db
    .selectDistinctOn([movimentos.itemId], {
      itemId: movimentos.itemId,
      preco: pedidoItens.precoUnitario,
    })
    .from(movimentos)
    .innerJoin(pedidoItens, eq(pedidoItens.id, movimentos.pedidoItemId))
    .where(eq(movimentos.tipo, "entrada_compra"))
    .orderBy(movimentos.itemId, desc(movimentos.criadoEm))
    .as("custo_recebido");
}

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
  localId: string | null;
  ativo: boolean;
  fisico: number;
  reservado: number;
  disponivel: number;
  valorEstoque: number;
  situacao: SituacaoItem;
};

/**
 * Nivel 0 e o equipamento montado: nao se compra, entao nunca conta como
 * falta nem entra no alerta de reposicao. Essa parte vem do desktop.
 *
 * O que mudou: montar uma estrutura passou a dar entrada de uma unidade no
 * nivel 0, e uma unidade pronta na prateleira nao pode aparecer como "nao
 * estocavel". Com saldo, ele e um item normal; sem saldo, continua fora da
 * conta de falta — ninguem compra um equipamento montado.
 */
export function situacaoDoItem(
  nivel: number,
  disponivel: number,
  estoqueMinimo: number,
): SituacaoItem {
  if (nivel === 0) return disponivel > 0 ? "ok" : "nao_estocavel";
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
  /** Um item so, escolhido pelo codigo no seletor. */
  itemId?: string;
  localId?: string;
}): Promise<ItemComSaldo[]> {
  const condicoes: SQL[] = [];

  /* O item escolhido no seletor aparece mesmo inativo: quem o escolheu pelo
     codigo ja sabe qual quer, e sumir seria a tela discordar do proprio
     seletor. */
  if (filtros?.itemId) condicoes.push(eq(itens.id, filtros.itemId));
  else if (!filtros?.incluirInativos) condicoes.push(eq(itens.ativo, true));

  const custo = custoDoUltimoRecebimento();
  if (filtros?.classificacaoId) {
    condicoes.push(eq(itens.classificacaoId, filtros.classificacaoId));
  }
  if (filtros?.nivel !== undefined) condicoes.push(eq(itens.nivel, filtros.nivel));
  if (filtros?.localId) condicoes.push(eq(itens.localId, filtros.localId));
  if (filtros?.busca) {
    const t = `%${filtros.busca}%`;
    condicoes.push(
      or(
        ilike(itens.codigo, t),
        ilike(itens.descricao, t),
        ilike(locais.nome, t),
      ) as SQL,
    );
  }

  const consulta = db
    .select({
      id: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      classificacao: classificacoes.nome,
      unidade: unidades.sigla,
      nivel: itens.nivel,
      custoUnitario: itens.custoUnitario,
      custoRecebido: sql<number | null>`${custo.preco}`,
      estoqueMinimo: itens.estoqueMinimo,
      localizacao: locais.nome,
      localId: itens.localId,
      ativo: itens.ativo,
      fisico: sql<number>`coalesce(${saldos.fisico}, 0)`,
      reservado: sql<number>`coalesce(${saldos.reservado}, 0)`,
    })
    .from(itens)
    .innerJoin(classificacoes, eq(classificacoes.id, itens.classificacaoId))
    .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(locais, eq(locais.id, itens.localId))
    .leftJoin(saldos, eq(saldos.itemId, itens.id))
    .leftJoin(custo, eq(custo.itemId, itens.id))
    .$dynamic();

  const linhas = await consulta
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(asc(itens.nivel), asc(itens.codigo));

  const comSaldo = linhas.map((l) => {
    const disponivel = l.fisico - l.reservado;
    /* Item que nunca foi comprado — fabricado, impresso, equipamento
       montado — nao tem recebimento de onde tirar custo, e ai vale o do
       cadastro. */
    const custoUnitario = l.custoRecebido !== null ? Number(l.custoRecebido) : l.custoUnitario;
    return {
      ...l,
      custoUnitario,
      disponivel,
      valorEstoque: l.fisico * custoUnitario,
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

/**
 * Tudo que se sabe sobre um pedido e sobre cada linha dele — inclusive o que
 * mora no cadastro do item e no vinculo com aquele fornecedor especifico.
 *
 * Uma consulta so, usada pela tela do pedido e pelo PDF que vai para o
 * pessoal de compras: assim as duas nunca mostram coisas diferentes. O PDF
 * precisa de bem mais do que a tela de recebimento mostrava (link do produto,
 * SKU, quantidade minima, ficha tecnica, parametros de impressao), e e por
 * isso que a consulta busca tanta coisa.
 */
export async function pedidoCompleto(id: string) {
  const [pedido] = await db
    .select({
      id: pedidosCompra.id,
      numero: pedidosCompra.numero,
      status: pedidosCompra.status,
      frete: pedidosCompra.frete,
      condicaoPagamento: pedidosCompra.condicaoPagamento,
      observacoes: pedidosCompra.observacoes,
      criadoEm: pedidosCompra.criadoEm,
      criadoPor: usuarios.nome,
      fornecedorId: fornecedores.id,
      fornecedor: fornecedores.nome,
      fornecedorContato: fornecedores.contato,
      fornecedorTelefone: fornecedores.telefone,
      fornecedorEmail: fornecedores.email,
      fornecedorSite: fornecedores.site,
      fornecedorFrete: fornecedores.frete,
      fornecedorObservacoes: fornecedores.observacoes,
      cotacaoId: cotacoes.id,
      cotacaoNumero: cotacoes.numero,
    })
    .from(pedidosCompra)
    .innerJoin(fornecedores, eq(fornecedores.id, pedidosCompra.fornecedorId))
    .leftJoin(cotacoes, eq(cotacoes.id, pedidosCompra.cotacaoId))
    .leftJoin(usuarios, eq(usuarios.id, pedidosCompra.criadoPor))
    .where(eq(pedidosCompra.id, id));

  if (!pedido) return null;

  const unidadeMinima = alias(unidades, "unidade_minima");

  const linhas = await db
    .select({
      id: pedidoItens.id,
      quantidade: pedidoItens.quantidade,
      recebida: pedidoItens.quantidadeRecebida,
      devolvida: pedidoItens.quantidadeDevolvida,
      precoUnitario: pedidoItens.precoUnitario,
      parametrosCompra: pedidoItens.parametrosCompra,

      itemId: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      classificacao: classificacoes.nome,
      unidade: unidades.sigla,
      nivel: itens.nivel,
      aquisicao: itens.aquisicao,
      origemFabricacao: itens.origemFabricacao,
      linkCompra: itens.linkCompra,
      localizacao: locais.nome,
      estoqueMinimo: itens.estoqueMinimo,
      observacoesItem: itens.observacoes,
      fichaTecnica: itens.fichaTecnica,
      prazoItem: itens.prazoValor,
      prazoItemUnidade: itens.prazoUnidade,

      /* Do vinculo com o fornecedor deste pedido — e onde esta o link do
         produto na loja e o codigo que o fornecedor usa. */
      sku: itemFornecedores.skuFornecedor,
      linkFornecedor: itemFornecedores.linkItem,
      precoTabela: itemFornecedores.preco,
      qtdMinima: itemFornecedores.qtdMinima,
      unidadeMinima: unidadeMinima.sigla,
      prazoFornecedor: itemFornecedores.prazoValor,
      prazoFornecedorUnidade: itemFornecedores.prazoUnidade,
      observacoesFornecedor: itemFornecedores.observacoes,

      material3d: itensParametros3d.material,
      alturaCamada3d: itensParametros3d.alturaCamada,
      preenchimento3d: itensParametros3d.preenchimento,
      pesoEstimado3d: itensParametros3d.pesoEstimado,

      fisico: sql<number>`coalesce(${saldos.fisico}, 0)`,
      reservado: sql<number>`coalesce(${saldos.reservado}, 0)`,
    })
    .from(pedidoItens)
    .innerJoin(itens, eq(itens.id, pedidoItens.itemId))
    .leftJoin(locais, eq(locais.id, itens.localId))
    .innerJoin(classificacoes, eq(classificacoes.id, itens.classificacaoId))
    .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(
      itemFornecedores,
      and(
        eq(itemFornecedores.itemId, pedidoItens.itemId),
        eq(itemFornecedores.fornecedorId, pedido.fornecedorId),
      ),
    )
    .leftJoin(unidadeMinima, eq(unidadeMinima.id, itemFornecedores.unidadeMinimaId))
    .leftJoin(itensParametros3d, eq(itensParametros3d.itemId, pedidoItens.itemId))
    .leftJoin(saldos, eq(saldos.itemId, pedidoItens.itemId))
    .where(eq(pedidoItens.pedidoId, id))
    .orderBy(asc(itens.codigo));

  return { pedido, linhas };
}

export type PedidoCompleto = NonNullable<Awaited<ReturnType<typeof pedidoCompleto>>>;
export type LinhaPedidoCompleta = PedidoCompleto["linhas"][number];

/* ------------------------------------------------------------ Montagem --- */

export type ComponenteDaMontagem = {
  itemId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  necessario: number;
  disponivel: number;
  obrigatorio: boolean;
  localMontagem: string | null;
  temEstrutura: boolean;
};

/**
 * O que e preciso ter em maos para montar uma unidade deste item.
 *
 * So os filhos diretos, de proposito. Montar EQP-001 consome o conjunto
 * EST-001 inteiro, e nao os 24 parafusos dele — os parafusos ja sairam do
 * estoque quando EST-001 foi montada. Cada nivel tem saldo proprio e o
 * historico mostra a montagem de cada etapa.
 */
export async function componentesDaMontagem(
  itemId: string,
  quantidade = 1,
): Promise<ComponenteDaMontagem[]> {
  const linhas = await db
    .select({
      itemId: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      unidade: unidades.sigla,
      necessario: bom.quantidade,
      obrigatorio: bom.obrigatorio,
      localMontagem: bom.localMontagem,
      fisico: sql<number>`coalesce(${saldos.fisico}, 0)`,
      reservado: sql<number>`coalesce(${saldos.reservado}, 0)`,
      /* Filho que tambem tem estrutura pode ser montado antes, e a tela
         oferece esse caminho quando ele esta em falta. O nome da tabela vai
         cru porque o bom ja esta no from de fora: o alias do drizzle nao
         sobrevive dentro do exists. */
      temEstrutura: sql<boolean>`exists (select 1 from bom sub where sub.pai_id = ${itens.id})`,
    })
    .from(bom)
    .innerJoin(itens, eq(itens.id, bom.filhoId))
    .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(saldos, eq(saldos.itemId, bom.filhoId))
    .where(eq(bom.paiId, itemId))
    .orderBy(asc(bom.ordem), asc(itens.codigo));

  return linhas.map((l) => ({
    itemId: l.itemId,
    codigo: l.codigo,
    descricao: l.descricao,
    unidade: l.unidade,
    necessario: l.necessario * quantidade,
    disponivel: l.fisico - l.reservado,
    obrigatorio: l.obrigatorio,
    localMontagem: l.localMontagem,
    temEstrutura: l.temEstrutura,
  }));
}

export async function listarMontagens(filtros?: { itemId?: string; incluirDesmontadas?: boolean }) {
  const condicoes: SQL[] = [];
  if (filtros?.itemId) condicoes.push(eq(montagens.itemId, filtros.itemId));
  if (!filtros?.incluirDesmontadas) {
    condicoes.push(sql`${montagens.status} <> 'desmontada'`);
  }

  return db
    .select({
      id: montagens.id,
      numero: montagens.numero,
      status: montagens.status,
      local: montagens.local,
      observacoes: montagens.observacoes,
      montadaEm: montagens.montadaEm,
      desmontadaEm: montagens.desmontadaEm,
      itemId: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      montadaPor: usuarios.nome,
      carroId: carros.id,
      placa: carros.placa,
    })
    .from(montagens)
    .innerJoin(itens, eq(itens.id, montagens.itemId))
    .leftJoin(usuarios, eq(usuarios.id, montagens.montadaPor))
    .leftJoin(carros, eq(carros.id, montagens.carroId))
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(desc(montagens.montadaEm));
}

export type Montagem = Awaited<ReturnType<typeof listarMontagens>>[number];

/* --------------------------------------------------------------- Frota --- */

export async function listarCarros() {
  const sistema = alias(versoes, "versao_sistema");
  const tablet = alias(versoes, "versao_tablet");

  return db
    .select({
      id: carros.id,
      placa: carros.placa,
      fabricante: carros.fabricante,
      modelo: carros.modelo,
      pc: carros.pc,
      versaoSistemaId: carros.versaoSistemaId,
      versaoSistema: sistema.numero,
      versaoTabletId: carros.versaoTabletId,
      versaoTablet: tablet.numero,
      montagemId: montagens.id,
      montagemNumero: montagens.numero,
      equipamentoId: itens.id,
      equipamentoCodigo: itens.codigo,
      equipamento: itens.descricao,
    })
    .from(carros)
    .leftJoin(sistema, eq(sistema.id, carros.versaoSistemaId))
    .leftJoin(tablet, eq(tablet.id, carros.versaoTabletId))
    /* O equipamento do carro e a montagem que aponta para ele. */
    .leftJoin(montagens, eq(montagens.carroId, carros.id))
    .leftJoin(itens, eq(itens.id, montagens.itemId))
    .orderBy(asc(carros.placa));
}

export type Carro = Awaited<ReturnType<typeof listarCarros>>[number];

export async function listarVersoes() {
  return db
    .select({
      id: versoes.id,
      tipo: versoes.tipo,
      numero: versoes.numero,
      notas: versoes.notas,
      lancadaEm: versoes.lancadaEm,
      emUso: sql<number>`(
        select count(*)::int from ${carros}
        where ${carros.versaoSistemaId} = ${versoes.id}
           or ${carros.versaoTabletId} = ${versoes.id}
      )`,
    })
    .from(versoes)
    .orderBy(asc(versoes.tipo), desc(versoes.lancadaEm), desc(versoes.numero));
}

export type Versao = Awaited<ReturnType<typeof listarVersoes>>[number];

/**
 * Montagens que podem ser escolhidas como equipamento de um carro: as que
 * estao prontas no estoque, mais a que ja esta neste carro — senao o proprio
 * equipamento instalado sumiria da lista na hora de editar.
 */
export async function montagensParaCarro(carroId?: string) {
  return db
    .select({
      id: montagens.id,
      numero: montagens.numero,
      status: montagens.status,
      local: montagens.local,
      montadaEm: montagens.montadaEm,
      codigo: itens.codigo,
      descricao: itens.descricao,
    })
    .from(montagens)
    .innerJoin(itens, eq(itens.id, montagens.itemId))
    .where(
      or(
        and(eq(montagens.status, "montada"), isNull(montagens.carroId)),
        carroId ? eq(montagens.carroId, carroId) : undefined,
      ),
    )
    .orderBy(desc(montagens.montadaEm));
}

export async function carroPorId(id: string) {
  const [carro] = await db.select().from(carros).where(eq(carros.id, id));
  if (!carro) return null;

  const [equipamento] = await db
    .select({ id: montagens.id })
    .from(montagens)
    .where(eq(montagens.carroId, id));

  return { ...carro, montagemId: equipamento?.id ?? null };
}

/**
 * Recorte de um mes sobre uma coluna de instante.
 *
 * A fronteira sai no fuso de Sao Paulo, e nao no do processo: na Vercel ele
 * roda em UTC, e um lancamento das 22h do dia 30 apareceria no mes seguinte
 * para quem digitou. Quem faz a conta e o Postgres, que conhece o historico
 * de horario de verao — aqui so entra a data limite.
 *
 * `>= inicio` e `< primeiro dia do mes seguinte`: com `<= ultimo dia` os
 * lancamentos do proprio ultimo dia ficariam de fora, porque a comparacao
 * carrega a hora junto.
 */
export function recorteDoMes(coluna: PgColumn, mes: string | undefined): SQL | undefined {
  if (!mes) return undefined;
  const { inicio, fim } = limitesDoMes(mes);
  return and(
    sql`${coluna} >= (${inicio}::timestamp AT TIME ZONE ${FUSO})`,
    sql`${coluna} < (${fim}::timestamp AT TIME ZONE ${FUSO})`,
  );
}

/**
 * Intervalo fechado de datas, com as duas pontas opcionais.
 *
 * O fim e `< o dia seguinte` pelo mesmo motivo de `recorteAte`: a comparacao
 * carrega a hora, e `<= o dia` deixaria de fora tudo que foi lancado depois
 * da meia-noite do ultimo dia escolhido.
 */
export function recorteEntre(
  coluna: PgColumn,
  de: string | undefined,
  ate: string | undefined,
): SQL | undefined {
  const partes: SQL[] = [];
  if (de) partes.push(sql`${coluna} >= (${de}::timestamp AT TIME ZONE ${FUSO})`);
  if (ate) partes.push(sql`${coluna} < (${diaSeguinte(ate)}::timestamp AT TIME ZONE ${FUSO})`);
  return partes.length ? and(...partes) : undefined;
}

/** Os locais cadastrados, para os seletores e o filtro. */
export async function listarLocais() {
  return db.select().from(locais).orderBy(asc(locais.nome));
}

/**
 * O codigo de todo item cadastrado, para o seletor da tela de itens. Vem
 * completa e nao filtrada: e ela que deixa escolher o item sem digitar,
 * entao encolher conforme os outros filtros tiraria justamente a opcao que a
 * pessoa esta procurando.
 */
export async function codigosDeItens() {
  return db
    .select({ id: itens.id, codigo: itens.codigo, ativo: itens.ativo })
    .from(itens)
    .orderBy(asc(itens.codigo));
}

/**
 * So os itens que ja tem movimento, para o seletor da tela de estoque nao
 * oferecer produto que nunca vai devolver linha nenhuma.
 */
export async function itensComMovimento() {
  return db
    .selectDistinct({ id: itens.id, codigo: itens.codigo, descricao: itens.descricao })
    .from(movimentos)
    .innerJoin(itens, eq(itens.id, movimentos.itemId))
    .orderBy(asc(itens.codigo));
}

/**
 * O registro mais antigo de cada lista, para o seletor de mes nao oferecer
 * mes vazio. Uma consulta por tela, porque cada uma tem a sua coluna de data.
 */
export async function primeiroMovimento(): Promise<Date | null> {
  const [l] = await db
    .select({ quando: sql<Date | null>`min(${movimentos.criadoEm})` })
    .from(movimentos);
  return l?.quando ? new Date(l.quando) : null;
}

export async function primeiraCotacao(): Promise<Date | null> {
  const [l] = await db
    .select({ quando: sql<Date | null>`min(${cotacoes.criadoEm})` })
    .from(cotacoes);
  return l?.quando ? new Date(l.quando) : null;
}

export async function primeiroPedido(): Promise<Date | null> {
  const [l] = await db
    .select({ quando: sql<Date | null>`min(${pedidosCompra.criadoEm})` })
    .from(pedidosCompra);
  return l?.quando ? new Date(l.quando) : null;
}

/**
 * Quantos registros em aberto o recorte esta escondendo.
 *
 * Pedido e cotacao em aberto sao fila de trabalho: limitar o mes e legitimo,
 * sumir com servico pendente sem avisar nao e. A tela diz o numero em vez de
 * deixar a pessoa concluir que nao ha nada a fazer.
 */
export async function abertosForaDoMes(
  qual: "cotacoes" | "pedidos",
  mes: string | undefined,
): Promise<number> {
  if (!mes) return 0;
  const dentro = recorteDoMes(
    qual === "cotacoes" ? cotacoes.criadoEm : pedidosCompra.criadoEm,
    mes,
  );
  const [l] =
    qual === "cotacoes"
      ? await db
          .select({ n: sql<number>`count(*)::int` })
          .from(cotacoes)
          .where(and(inArray(cotacoes.status, ["rascunho", "enviada", "respondida"]), not(dentro!)))
      : await db
          .select({ n: sql<number>`count(*)::int` })
          .from(pedidosCompra)
          .where(and(inArray(pedidosCompra.status, ["aberto", "parcial"]), not(dentro!)));
  return l?.n ?? 0;
}
