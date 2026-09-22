import {
  and,
  asc,
  desc,
  eq,
  getTableName,
  ilike,
  inArray,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";

import { diaSeguinte, FUSO, limitesDoMes } from "@/lib/periodo";

import { db } from "./index";
import {
  aquisicoes,
  classificacoes,
  cotacaoItens,
  cotacoes,
  divisoes,
  fornecedores,
  itemFornecedores,
  itemFotos,
  itens,
  locais,
  materiais3d,
  origensFabricacao,
  itensParametros3d,
  moldeNos,
  moldes,
  montagemNos,
  montagens,
  movimentos,
  pedidoItens,
  pedidosCompra,
  unidades,
  usuarios,
} from "./schema";

/**
 * Referencia qualificada de coluna — `"moldes"."id"` em vez de `"id"`.
 *
 * Existe por causa de uma armadilha silenciosa: na lista de selecao, o
 * drizzle renderiza `${tabela.coluna}` sem o nome da tabela. Dentro de uma
 * subconsulta correlacionada isso passa a ser resolvido pela tabela de
 * dentro, que quase sempre tambem tem uma coluna `id` — e a correlacao vira
 * `n.molde_id = n.id`, que nunca e verdade.
 *
 * O erro nao aparece: a consulta roda, nao reclama, e devolve zero para
 * tudo. Foi assim que a tela de montagem passou a dizer que nao existia
 * nenhuma estrutura, com dois moldes cheios no banco.
 */
function ref(coluna: PgColumn): SQL {
  return sql.raw(`"${getTableName(coluna.table)}"."${coluna.name}"`);
}

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

export type SituacaoItem = "ok" | "falta" | "abaixo_minimo";

export type ItemComSaldo = {
  id: string;
  codigo: string;
  descricao: string;
  classificacao: string;
  unidade: string;
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
 * A situacao responde "e agora, o que eu faco?".
 *
 * Todo item e peca de estoque — equipamento e divisao vivem no molde, nunca
 * aqui. Entao nao ha mais caso especial: sem saldo e falta, abaixo do minimo
 * e alerta de reposicao, e pronto.
 */
const disponivelSql = sql<number>`(coalesce(${saldos.fisico}, 0) - coalesce(${saldos.reservado}, 0))`;

/*
 * Em SQL, e nao em TypeScript, porque a tela pagina: filtrar situacao depois
 * da consulta obrigaria a trazer o catalogo inteiro para descartar quase
 * tudo, e o LIMIT cairia no conjunto errado. Fica uma implementacao so — a
 * versao em JS existia e foi movida para ca inteira.
 */
const situacaoSql = sql<SituacaoItem>`case
  when ${disponivelSql} <= 0 then 'falta'
  when ${itens.estoqueMinimo} > 0 and ${disponivelSql} < ${itens.estoqueMinimo}
    then 'abaixo_minimo'
  else 'ok'
end`;

export type FiltrosItens = {
  busca?: string;
  classificacaoId?: string;
  situacao?: SituacaoItem;
  /* Vazio mostra só o que está ativo, que é o caso de quase toda visita. Um
     item desativado continua existindo e ainda segura a classificação dele
     contra exclusão, então precisa haver como enxergá-lo. */
  cadastro?: "todos" | "inativos";
  localId?: string;
};

function condicoesDeItens(filtros?: FiltrosItens): SQL[] {
  const condicoes: SQL[] = [];

  if (filtros?.cadastro === "inativos") condicoes.push(eq(itens.ativo, false));
  else if (filtros?.cadastro !== "todos") condicoes.push(eq(itens.ativo, true));

  if (filtros?.classificacaoId) {
    condicoes.push(eq(itens.classificacaoId, filtros.classificacaoId));
  }
  if (filtros?.localId) condicoes.push(eq(itens.localId, filtros.localId));
  if (filtros?.situacao) condicoes.push(sql`${situacaoSql} = ${filtros.situacao}`);
  if (filtros?.busca) {
    const t = `%${filtros.busca}%`;
    condicoes.push(
      or(ilike(itens.codigo, t), ilike(itens.descricao, t), ilike(locais.nome, t)) as SQL,
    );
  }
  return condicoes;
}

/** Quantos itens o filtro alcanca, para o rodape de paginacao. */
export async function contarItens(filtros?: FiltrosItens): Promise<number> {
  const condicoes = condicoesDeItens(filtros);
  const [l] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(itens)
    .leftJoin(locais, eq(locais.id, itens.localId))
    .leftJoin(saldos, eq(saldos.itemId, itens.id))
    .where(condicoes.length ? and(...condicoes) : undefined);
  return l?.n ?? 0;
}

export async function listarItensComSaldo(
  filtros?: FiltrosItens & {
    /** Sem isto a consulta traz tudo — as outras telas dependem disso. */
    porPagina?: number;
    pular?: number;
  },
): Promise<ItemComSaldo[]> {
  const condicoes = condicoesDeItens(filtros);
  const custo = custoDoUltimoRecebimento();

  const consulta = db
    .select({
      id: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      classificacao: classificacoes.nome,
      unidade: unidades.sigla,
      custoUnitario: itens.custoUnitario,
      custoRecebido: sql<number | null>`${custo.preco}`,
      estoqueMinimo: itens.estoqueMinimo,
      localizacao: locais.nome,
      localId: itens.localId,
      ativo: itens.ativo,
      fisico: sql<number>`coalesce(${saldos.fisico}, 0)`,
      reservado: sql<number>`coalesce(${saldos.reservado}, 0)`,
      situacao: situacaoSql,
    })
    .from(itens)
    .innerJoin(classificacoes, eq(classificacoes.id, itens.classificacaoId))
    .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(locais, eq(locais.id, itens.localId))
    .leftJoin(saldos, eq(saldos.itemId, itens.id))
    .leftJoin(custo, eq(custo.itemId, itens.id))
    .$dynamic();

  consulta
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(asc(itens.codigo));

  if (filtros?.porPagina) consulta.limit(filtros.porPagina).offset(filtros.pular ?? 0);

  const linhas = await consulta;

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
    };
  });

  return comSaldo;
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
      fornecedorEndereco: fornecedores.endereco,
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
      /* Nome vindo da lista, nao chave de enum: quem le o PDF quer
         "Compra importada", e a lista e editavel em Configuracoes. */
      aquisicao: aquisicoes.nome,
      origemFabricacao: origensFabricacao.nome,
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

      material3d: materiais3d.nome,
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
    .leftJoin(aquisicoes, eq(aquisicoes.id, itens.aquisicaoId))
    .leftJoin(origensFabricacao, eq(origensFabricacao.id, itens.origemFabricacaoId))
    .leftJoin(materiais3d, eq(materiais3d.id, itensParametros3d.materialId))
    .leftJoin(saldos, eq(saldos.itemId, pedidoItens.itemId))
    .where(eq(pedidoItens.pedidoId, id))
    .orderBy(asc(itens.codigo));

  /* Consulta a parte para o bytea nao entrar no join la em cima: ali ele se
     repetiria em cada linha do resultado. */
  const fotos = await fotosDoPdf(linhas.map((l) => l.itemId));

  return { pedido, linhas, fotos };
}

/**
 * A miniatura da foto principal de cada item, em bytes, para o PDF.
 *
 * Vai a miniatura e nao a foto inteira: o pedido e anexo de e-mail, e quinze
 * fotos de 220 KB fariam um arquivo de 3 MB. Nos 90pt que ela ocupa na folha,
 * os 260px da miniatura dao cerca de 200 DPI.
 */
async function fotosDoPdf(itemIds: string[]): Promise<Map<string, Buffer>> {
  if (itemIds.length === 0) return new Map();

  const linhas = await db
    .select({ itemId: itemFotos.itemId, bytes: itemFotos.miniatura, tipo: itemFotos.tipo })
    .from(itemFotos)
    .where(inArray(itemFotos.itemId, itemIds))
    .orderBy(asc(itemFotos.itemId), asc(itemFotos.ordem));

  const primeira = new Map<string, Buffer>();
  for (const linha of linhas) {
    /* O pdf-lib so embute JPEG, e e o que o navegador gera. Outro formato
       aqui so chegaria por caminho que nao passou pela tela — ignora. */
    if (linha.tipo !== "image/jpeg") continue;
    if (!primeira.has(linha.itemId)) primeira.set(linha.itemId, linha.bytes);
  }
  return primeira;
}

/**
 * O que o PDF de cotacao pode mostrar — e, principalmente, o que ele nao pode.
 *
 * O mesmo arquivo vai para varios fornecedores ao mesmo tempo, que estao
 * sendo comparados entre si. Entao aqui nao entra nome de fornecedor, preco,
 * vinculo, SKU nem link de loja: qualquer um desses contaria a um deles com
 * quem ele esta competindo, ou por quanto. Sai so o que descreve a peca.
 *
 * `cotacoes.observacoes` tambem fica de fora de proposito: e campo livre da
 * equipe, onde cabe "pedir pra fulano" — nao da para garantir que nao vaze.
 */
export async function cotacaoParaPdf(id: string) {
  const [cotacao] = await db
    .select({
      id: cotacoes.id,
      numero: cotacoes.numero,
      titulo: cotacoes.titulo,
      criadoEm: cotacoes.criadoEm,
      criadoPor: usuarios.nome,
    })
    .from(cotacoes)
    .leftJoin(usuarios, eq(usuarios.id, cotacoes.criadoPor))
    .where(eq(cotacoes.id, id));

  if (!cotacao) return null;

  const linhas = await db
    .select({
      itemId: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      quantidade: cotacaoItens.quantidade,
      unidade: unidades.sigla,
      /* Especificacao da peca: e o que deixa o fornecedor cotar a coisa certa
         em vez de perguntar de volta. */
      fichaTecnica: itens.fichaTecnica,
      material3d: materiais3d.nome,
      alturaCamada3d: itensParametros3d.alturaCamada,
      preenchimento3d: itensParametros3d.preenchimento,
      pesoEstimado3d: itensParametros3d.pesoEstimado,
    })
    .from(cotacaoItens)
    .innerJoin(itens, eq(itens.id, cotacaoItens.itemId))
    .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(itensParametros3d, eq(itensParametros3d.itemId, cotacaoItens.itemId))
    .leftJoin(materiais3d, eq(materiais3d.id, itensParametros3d.materialId))
    .where(eq(cotacaoItens.cotacaoId, id))
    .orderBy(asc(itens.codigo));

  /* Consulta a parte pelo mesmo motivo do pedido: o bytea se repetiria em
     cada linha se entrasse no join la em cima. */
  const fotos = await fotosDoPdf(linhas.map((l) => l.itemId));

  return { cotacao, linhas, fotos };
}

export type CotacaoParaPdf = NonNullable<Awaited<ReturnType<typeof cotacaoParaPdf>>>;
export type LinhaDaCotacaoPdf = CotacaoParaPdf["linhas"][number];

export type PedidoCompleto = NonNullable<Awaited<ReturnType<typeof pedidoCompleto>>>;
export type LinhaPedidoCompleta = PedidoCompleto["linhas"][number];

/* ------------------------------------------------------------ Montagem --- */

export type NoDoMolde = {
  id: string;
  paiId: string | null;
  /** Divisao: nome do agrupador. Peca: null. */
  divisaoId: string | null;
  nome: string | null;
  itemId: string | null;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  custo: number;
  quantidade: number;
  localMontagem: string | null;
  ordem: number;
  disponivel: number;
};

/** A arvore crua de um molde, plana. Quem monta em arvore e a tela. */
export async function nosDoMolde(moldeId: string): Promise<NoDoMolde[]> {
  const custo = custoDoUltimoRecebimento();

  return db
    .select({
      id: moldeNos.id,
      paiId: moldeNos.paiId,
      divisaoId: moldeNos.divisaoId,
      nome: divisoes.nome,
      itemId: moldeNos.itemId,
      codigo: itens.codigo,
      descricao: itens.descricao,
      unidade: unidades.sigla,
      /* Custo derivado, como manda a regra: o preco do ultimo recebimento,
         e o campo do item so como reserva para o que nunca foi comprado. */
      custo: sql<number>`coalesce(${custo.preco}, ${itens.custoUnitario}, 0)`,
      quantidade: moldeNos.quantidade,
      localMontagem: moldeNos.localMontagem,
      ordem: moldeNos.ordem,
      disponivel: sql<number>`coalesce(${saldos.fisico}, 0) - coalesce(${saldos.reservado}, 0)`,
    })
    .from(moldeNos)
    .leftJoin(divisoes, eq(divisoes.id, moldeNos.divisaoId))
    .leftJoin(saldos, eq(saldos.itemId, moldeNos.itemId))
    .leftJoin(itens, eq(itens.id, moldeNos.itemId))
    .leftJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(custo, eq(custo.itemId, moldeNos.itemId))
    .where(eq(moldeNos.moldeId, moldeId))
    .orderBy(asc(moldeNos.ordem), asc(moldeNos.id));
}

/**
 * As estruturas. `itemId` preenchido e conjunto (receita de um item do estoque);
 * vazio e manual de equipamento completo. A tela separa as duas listas por
 * esse campo, e so o conjunto chega na montagem.
 */
export async function listarMoldes() {
  return db
    .select({
      id: moldes.id,
      nome: moldes.nome,
      descricao: moldes.descricao,
      ativo: moldes.ativo,
      itemId: moldes.itemId,
      codigo: itens.codigo,
      itemDescricao: itens.descricao,
      unidade: unidades.sigla,
      nos: sql<number>`(select count(*)::int from molde_nos n where n.molde_id = ${ref(moldes.id)})`,
      /* So as abertas: o total de todas as vezes que este conjunto ja foi
         montado e historia, e historia mora no historico. Aqui a pergunta e
         "tem gente montando isso agora?". */
      emMontagem: sql<number>`(select count(*)::int from montagens m
        where m.molde_id = ${ref(moldes.id)} and m.status = 'em_montagem')`,
      /* Saldo do proprio item produzido: "tenho 6 domos prontos" e a primeira
         pergunta de quem abre esta tela. */
      emEstoque: sql<number>`coalesce(${saldos.fisico}, 0) - coalesce(${saldos.reservado}, 0)`,
    })
    .from(moldes)
    .leftJoin(itens, eq(itens.id, moldes.itemId))
    .leftJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(saldos, eq(saldos.itemId, moldes.itemId))
    .orderBy(asc(moldes.nome));
}

export type Molde = Awaited<ReturnType<typeof listarMoldes>>[number];

export type NoDaMontagem = {
  id: string;
  paiId: string | null;
  nome: string | null;
  itemId: string | null;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade: number;
  localMontagem: string | null;
  ordem: number;
  /** Saldo do item hoje. Zero para divisao, que nao tem saldo nenhum. */
  disponivel: number;
  custo: number;
};

/**
 * A arvore de uma montagem, com o saldo de cada peca no momento da consulta.
 *
 * O saldo entra aqui e nao na hora de montar porque a tela precisa mostrar o
 * que falta antes de a pessoa clicar — e a acao confere de novo no servidor,
 * que entre abrir a tela e confirmar alguem pode ter consumido a ultima peca.
 */
export async function nosDaMontagem(montagemId: string): Promise<NoDaMontagem[]> {
  const custo = custoDoUltimoRecebimento();

  return db
    .select({
      id: montagemNos.id,
      paiId: montagemNos.paiId,
      nome: montagemNos.nome,
      itemId: montagemNos.itemId,
      codigo: itens.codigo,
      descricao: itens.descricao,
      unidade: unidades.sigla,
      quantidade: montagemNos.quantidade,
      localMontagem: montagemNos.localMontagem,
      ordem: montagemNos.ordem,
      disponivel: sql<number>`coalesce(${saldos.fisico}, 0) - coalesce(${saldos.reservado}, 0)`,
      custo: sql<number>`coalesce(${custo.preco}, ${itens.custoUnitario}, 0)`,
    })
    .from(montagemNos)
    .leftJoin(itens, eq(itens.id, montagemNos.itemId))
    .leftJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(saldos, eq(saldos.itemId, montagemNos.itemId))
    .leftJoin(custo, eq(custo.itemId, montagemNos.itemId))
    .where(eq(montagemNos.montagemId, montagemId))
    .orderBy(asc(montagemNos.ordem), asc(montagemNos.id));
}

/**
 * As montagens, filtradas por estado.
 *
 * Sao duas telas, e a separacao e o que impede a de trabalho de crescer sem
 * fim: `/montagem` lista so o que esta aberto — o que ainda tem o que fazer —
 * e o historico guarda o que ja foi montado, que nao tem mais acao nenhuma
 * porque virou movimento no estoque.
 *
 * Nao existe progresso parcial para mostrar: a montagem fecha inteira de uma
 * vez. O que a tela precisa e o que sai pronto e o que a arvore consome, e o
 * segundo vem de `nosDaMontagem`.
 */
export async function listarMontagens(filtros?: {
  status?: "em_montagem" | "montada";
  de?: string;
  ate?: string;
  porPagina?: number;
  pular?: number;
}) {
  const condicoes = [
    filtros?.status ? eq(montagens.status, filtros.status) : undefined,
    recorteEntre(montagens.montadaEm, filtros?.de, filtros?.ate),
  ].filter(Boolean) as SQL[];

  const consulta = db
    .select({
      id: montagens.id,
      numero: montagens.numero,
      nome: montagens.nome,
      moldeId: montagens.moldeId,
      itemId: montagens.itemId,
      codigo: itens.codigo,
      itemDescricao: itens.descricao,
      unidade: unidades.sigla,
      status: montagens.status,
      local: montagens.local,
      observacoes: montagens.observacoes,
      iniciadaEm: montagens.iniciadaEm,
      montadaEm: montagens.montadaEm,
      montadaPor: usuarios.nome,
    })
    .from(montagens)
    .leftJoin(usuarios, eq(usuarios.id, montagens.montadaPor))
    .leftJoin(itens, eq(itens.id, montagens.itemId))
    .leftJoin(unidades, eq(unidades.id, itens.unidadeId))
    .where(condicoes.length ? and(...condicoes) : undefined)
    /* Aberta ordena pela abertura (a mais antiga cobra atencao primeiro);
       montada, pela conclusao, que e o que o historico pergunta. */
    .orderBy(
      filtros?.status === "montada" ? desc(montagens.montadaEm) : desc(montagens.iniciadaEm),
    );

  return filtros?.porPagina
    ? consulta.limit(filtros.porPagina).offset(filtros.pular ?? 0)
    : consulta;
}

/** Quantas montagens o filtro alcanca, para o rodape de paginacao. */
export async function contarMontagens(filtros?: {
  status?: "em_montagem" | "montada";
  de?: string;
  ate?: string;
}): Promise<number> {
  const condicoes = [
    filtros?.status ? eq(montagens.status, filtros.status) : undefined,
    recorteEntre(montagens.montadaEm, filtros?.de, filtros?.ate),
  ].filter(Boolean) as SQL[];

  const [l] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(montagens)
    .where(condicoes.length ? and(...condicoes) : undefined);
  return l?.n ?? 0;
}

export type Montagem = Awaited<ReturnType<typeof listarMontagens>>[number];

/** A primeira montagem concluída, para o seletor de período do histórico. */
export async function primeiraMontagem(): Promise<Date | null> {
  const [l] = await db
    .select({ quando: montagens.montadaEm })
    .from(montagens)
    .where(sql`${montagens.montadaEm} is not null`)
    .orderBy(asc(montagens.montadaEm))
    .limit(1);
  return l?.quando ?? null;
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
 * Todas as fotos de cada item de uma lista ja carregada, na ordem do cadastro
 * — a primeira e a principal.
 *
 * Consulta a parte, e nao subconsulta dentro da listagem, por dois motivos:
 * a listagem de itens ja e grande demais para ganhar mais um correlacionado,
 * e assim so os ids da pagina vao ao banco. Devolve id de foto, nunca bytes —
 * quem busca a imagem e /api/fotos.
 *
 * Vem a lista inteira e nao so a principal porque quem clica na miniatura
 * abre a galeria, e ela precisa saber para onde navegar sem outra ida ao
 * servidor. Sao ids: tres por item, no maximo.
 */
export async function fotosDosItens(itemIds: string[]): Promise<Map<string, string[]>> {
  if (itemIds.length === 0) return new Map();

  const linhas = await db
    .select({ itemId: itemFotos.itemId, id: itemFotos.id })
    .from(itemFotos)
    .where(inArray(itemFotos.itemId, itemIds))
    .orderBy(asc(itemFotos.itemId), asc(itemFotos.ordem));

  const porItem = new Map<string, string[]>();
  for (const linha of linhas) {
    const lista = porItem.get(linha.itemId);
    if (lista) lista.push(linha.id);
    else porItem.set(linha.itemId, [linha.id]);
  }
  return porItem;
}

/** So a foto principal, para quem mostra um quadrado e nada mais. */
export async function fotosPrincipais(itemIds: string[]): Promise<Map<string, string>> {
  const todas = await fotosDosItens(itemIds);
  return new Map([...todas].map(([itemId, fotos]) => [itemId, fotos[0]]));
}

/** Um item de um documento, com a foto que o representa na lista. */
export type MiniaturaDeItem = {
  itemId: string;
  codigo: string;
  descricao: string;
  fotoId: string;
};

/**
 * A foto principal de cada item das cotacoes de uma pagina.
 *
 * A lista mostra documentos, nao itens — a pilha de miniaturas e o unico
 * jeito de reconhecer a cotacao antes de abrir. So os ids da pagina vao ao
 * banco, e so quem tem foto volta: item sem foto nao ocupa lugar na pilha.
 */
export async function miniaturasDeCotacoes(
  cotacaoIds: string[],
): Promise<Map<string, MiniaturaDeItem[]>> {
  if (cotacaoIds.length === 0) return new Map();

  const linhas = await db
    .select({
      documentoId: cotacaoItens.cotacaoId,
      itemId: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      fotoId: itemFotos.id,
    })
    .from(cotacaoItens)
    .innerJoin(itens, eq(itens.id, cotacaoItens.itemId))
    .innerJoin(itemFotos, eq(itemFotos.itemId, cotacaoItens.itemId))
    .where(inArray(cotacaoItens.cotacaoId, cotacaoIds))
    .orderBy(asc(cotacaoItens.cotacaoId), asc(itens.codigo), asc(itemFotos.ordem));

  return primeiraFotoPorItem(linhas);
}

/** O mesmo para os pedidos. */
export async function miniaturasDePedidos(
  pedidoIds: string[],
): Promise<Map<string, MiniaturaDeItem[]>> {
  if (pedidoIds.length === 0) return new Map();

  const linhas = await db
    .select({
      documentoId: pedidoItens.pedidoId,
      itemId: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      fotoId: itemFotos.id,
    })
    .from(pedidoItens)
    .innerJoin(itens, eq(itens.id, pedidoItens.itemId))
    .innerJoin(itemFotos, eq(itemFotos.itemId, pedidoItens.itemId))
    .where(inArray(pedidoItens.pedidoId, pedidoIds))
    .orderBy(asc(pedidoItens.pedidoId), asc(itens.codigo), asc(itemFotos.ordem));

  return primeiraFotoPorItem(linhas);
}

/* Um item aparece uma vez so na pilha: a pilha representa o que o documento
   pede, nao quantas fotos cada peca tem. */
function primeiraFotoPorItem(
  linhas: (MiniaturaDeItem & { documentoId: string })[],
): Map<string, MiniaturaDeItem[]> {
  const porDocumento = new Map<string, MiniaturaDeItem[]>();

  for (const linha of linhas) {
    const lista = porDocumento.get(linha.documentoId) ?? [];
    if (lista.some((m) => m.itemId === linha.itemId)) continue;
    lista.push({
      itemId: linha.itemId,
      codigo: linha.codigo,
      descricao: linha.descricao,
      fotoId: linha.fotoId,
    });
    porDocumento.set(linha.documentoId, lista);
  }
  return porDocumento;
}

/**
 * So os itens que ja foram cotados, para o filtro da tela de cotacoes nao
 * oferecer codigo que devolve lista vazia. Mesmo espirito de
 * `itensComMovimento`.
 */
export async function itensEmCotacoes() {
  return db
    .selectDistinct({ id: itens.id, codigo: itens.codigo, descricao: itens.descricao })
    .from(cotacaoItens)
    .innerJoin(itens, eq(itens.id, cotacaoItens.itemId))
    .orderBy(asc(itens.codigo));
}

/** O mesmo para os pedidos. */
export async function itensEmPedidos() {
  return db
    .selectDistinct({ id: itens.id, codigo: itens.codigo, descricao: itens.descricao })
    .from(pedidoItens)
    .innerJoin(itens, eq(itens.id, pedidoItens.itemId))
    .orderBy(asc(itens.codigo));
}

/** So quem ja recebeu pedido, para o filtro de fornecedor da tela de pedidos. */
export async function fornecedoresComPedido() {
  return db
    .selectDistinct({ id: fornecedores.id, nome: fornecedores.nome })
    .from(pedidosCompra)
    .innerJoin(fornecedores, eq(fornecedores.id, pedidosCompra.fornecedorId))
    .orderBy(asc(fornecedores.nome));
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
 * Os itens de uma cotacao que ja viraram linha de pedido.
 *
 * Existe porque a cotacao agora pode ficar aberta depois de uma geracao
 * parcial: sem isto, gerar de novo duplicaria as linhas que ja foram
 * compradas. Pedido cancelado nao conta — ali a compra precisa mesmo voltar
 * a ser possivel pela cotacao de origem.
 */
export async function itensJaPedidos(cotacaoId: string): Promise<Set<string>> {
  const linhas = await db
    .select({ itemId: pedidoItens.itemId })
    .from(pedidoItens)
    .innerJoin(pedidosCompra, eq(pedidosCompra.id, pedidoItens.pedidoId))
    .where(
      and(
        eq(pedidosCompra.cotacaoId, cotacaoId),
        not(eq(pedidosCompra.status, "cancelado")),
      ),
    );

  return new Set(linhas.map((l) => l.itemId));
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
