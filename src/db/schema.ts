import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------
 * Enums
 *
 * As chaves sao ASCII de proposito. No sistema desktop os tipos de movimento
 * eram gravados com acento ("Entrada fabricacao") e comparados contra strings
 * escritas a mao, o que gerou o bug critico nº 1 anotado no cabecalho do
 * MPZ-ERP-V35.pyw: movimentos que nunca batiam e sumiam do calculo de saldo.
 * Aqui o banco guarda a chave sem acento e o rotulo acentuado vive em
 * src/lib/labels.ts, usado so na hora de exibir.
 * ---------------------------------------------------------------------- */

export const papelUsuario = pgEnum("papel_usuario", ["admin", "editor", "leitura"]);

export const tipoMovimento = pgEnum("tipo_movimento", [
  "entrada_compra",
  "entrada_fabricacao",
  "saida_producao",
  "reserva",
  "liberacao_reserva",
  "ajuste_positivo",
  "ajuste_negativo",
  /* Volta para o fornecedor. Nao e ajuste_negativo porque o historico
     precisa distinguir "sumiu do estoque" de "devolvido a quem vendeu". */
  "devolucao_compra",
]);

export const tipoAquisicao = pgEnum("tipo_aquisicao", [
  "compra_nacional",
  "compra_importada",
  "fabricacao_interna",
  "sob_encomenda",
]);

export const origemFabricacao = pgEnum("origem_fabricacao", [
  "interna_impressao_3d",
  "interna_usinagem",
  "interna_montagem",
  "terceiro_impressao_3d",
  "terceiro_usinagem",
  "terceiro_corte_dobra",
  "compra_pronta_nacional",
  "compra_importada",
]);

export const statusFornecedor = pgEnum("status_fornecedor", [
  "preferencial",
  "aprovado",
  "em_avaliacao",
  "emergencia",
  "bloqueado",
]);

export const statusCotacao = pgEnum("status_cotacao", [
  "rascunho",
  "enviada",
  "respondida",
  "fechada",
  "cancelada",
]);

export const statusPedido = pgEnum("status_pedido", [
  "aberto",
  "parcial",
  "recebido",
  "cancelado",
]);

export const unidadePrazo = pgEnum("unidade_prazo", ["horas", "dias"]);

/* Versao do sistema que roda no PC do carro e do app que roda no tablet. */
export const tipoVersao = pgEnum("tipo_versao", ["sistema", "tablet"]);

export const statusMontagem = pgEnum("status_montagem", [
  "montada",
  "instalada",
  "desmontada",
  /* Arvore aberta e ainda incompleta. Vem por ultimo porque acrescentar valor
     no meio de um enum do Postgres exige recriar o tipo. */
  "em_montagem",
]);

export const acaoAuditoria = pgEnum("acao_auditoria", ["criar", "atualizar", "excluir"]);

/*
 * Dinheiro e quantidade em numeric (exato no banco) lido como number no TS.
 *
 * O zero vai como SQL literal, e nao como `.default(0)`, por causa do
 * comparador do drizzle-kit: ele le o default de uma coluna numeric do banco
 * como a string '0' e comparava contra o numero 0, achando diferenca em 17
 * colunas a cada `db:push`. Statement nenhum resolvia — aplicar nao mudava o
 * banco, que ja guardava 0 —, e essa enxurrada de ruido escondia divergencia
 * de verdade no meio dela.
 */
const zero = sql`'0'`;
const dinheiro = (nome: string) =>
  numeric(nome, { precision: 14, scale: 4, mode: "number" }).notNull().default(zero);
const quantidade = (nome: string) =>
  numeric(nome, { precision: 14, scale: 4, mode: "number" }).notNull().default(zero);

const criadoEm = timestamp("criado_em", { withTimezone: true }).notNull().defaultNow();

/* -------------------------------------------------------------------------
 * Acesso
 * ---------------------------------------------------------------------- */

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  papel: papelUsuario("papel").notNull().default("editor"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm,
});

/* -------------------------------------------------------------------------
 * Configuracao
 *
 * No desktop isto era lista fixa no topo do arquivo (CLASSIFICATIONS, UNITS,
 * o dicionario de prefixos dentro de code_suggestion e as regras de classify).
 * Virando tabela, ele edita pela tela de configuracoes sem mexer em codigo.
 * ---------------------------------------------------------------------- */

export const classificacoes = pgTable("classificacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  /* Prefixo usado na sugestao de codigo: FIX-PAR-M6X20 */
  prefixoCodigo: text("prefixo_codigo").notNull(),
  ordem: integer("ordem").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
});

export const unidades = pgTable("unidades", {
  id: uuid("id").primaryKey().defaultRandom(),
  sigla: text("sigla").notNull().unique(),
  nome: text("nome").notNull(),
  ativo: boolean("ativo").notNull().default(true),
});

/**
 * Onde a peca fica guardada.
 *
 * Era texto livre no item, e texto livre vira cadastro duplicado: "Gaveta
 * B3", "gaveta b3" e "Gaveta B-3" viram tres lugares que sao um so, e af
 * nao da para filtrar nem conferir prateleira. Virando cadastro, o item so
 * escolhe de uma lista.
 */
export const locais = pgTable("locais", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  ativo: boolean("ativo").notNull().default(true),
});

/* As 10 regras de classify(): palavra na descricao -> classificacao. */
export const regrasClassificacao = pgTable(
  "regras_classificacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classificacaoId: uuid("classificacao_id")
      .notNull()
      .references(() => classificacoes.id, { onDelete: "cascade" }),
    palavraChave: text("palavra_chave").notNull(),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [unique("regras_classificacao_palavra_unica").on(t.palavraChave)],
);

/* -------------------------------------------------------------------------
 * Cadastro de itens
 * ---------------------------------------------------------------------- */

export const itens = pgTable("itens", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  descricao: text("descricao").notNull(),
  classificacaoId: uuid("classificacao_id")
    .notNull()
    .references(() => classificacoes.id, { onDelete: "restrict" }),
  unidadeId: uuid("unidade_id")
    .notNull()
    .references(() => unidades.id, { onDelete: "restrict" }),
  aquisicao: tipoAquisicao("aquisicao"),
  origemFabricacao: origemFabricacao("origem_fabricacao"),
  linkCompra: text("link_compra"),
  prazoValor: quantidade("prazo_valor"),
  prazoUnidade: unidadePrazo("prazo_unidade").notNull().default("dias"),
  custoUnitario: dinheiro("custo_unitario"),
  /* Nao existia no desktop. E o que permite o alerta de reposicao. */
  estoqueMinimo: quantidade("estoque_minimo"),
  /* Opcional: peca recem-cadastrada ainda nao tem lugar definido. */
  localId: uuid("local_id").references(() => locais.id, { onDelete: "restrict" }),
  /* No desktop os dois viviam num TEXT so, separados por marcadores
     [OBSERVACOES]...[/OBSERVACOES] e lidos de volta por regex. */
  observacoes: text("observacoes"),
  fichaTecnica: text("ficha_tecnica"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm,
  criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoPor: uuid("atualizado_por").references(() => usuarios.id, { onDelete: "set null" }),
});

/* No desktop estes campos eram concatenados como texto no fim das
   observacoes, dentro de um marcador [PARAMETROS_3D]. */
export const itensParametros3d = pgTable("itens_parametros_3d", {
  itemId: uuid("item_id")
    .primaryKey()
    .references(() => itens.id, { onDelete: "cascade" }),
  material: text("material"),
  tempBico: text("temp_bico"),
  tempMesa: text("temp_mesa"),
  preenchimento: text("preenchimento"),
  alturaCamada: text("altura_camada"),
  diametroBico: text("diametro_bico"),
  pesoEstimado: text("peso_estimado"),
  tempoEstimado: text("tempo_estimado"),
});

/* -------------------------------------------------------------------------
 * Fornecedores
 *
 * No desktop a tabela suppliers tinha item_code: o mesmo fornecedor era
 * redigitado inteiro a cada item e nao dava pra perguntar "o que eu compro
 * deste fornecedor". Normalizar e o que torna a cotacao de compra possivel.
 * ---------------------------------------------------------------------- */

export const fornecedores = pgTable("fornecedores", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  contato: text("contato"),
  telefone: text("telefone"),
  email: text("email"),
  site: text("site"),
  /* Texto livre de proposito: fornecedor online (Mercado Livre, AliExpress)
     nao tem endereco, e quem tem escreve do jeito que o Maps entende. */
  endereco: text("endereco"),
  condicaoPagamento: text("condicao_pagamento"),
  frete: text("frete"),
  status: statusFornecedor("status").notNull().default("em_avaliacao"),
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm,
});

export const itemFornecedores = pgTable(
  "item_fornecedores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => itens.id, { onDelete: "cascade" }),
    fornecedorId: uuid("fornecedor_id")
      .notNull()
      .references(() => fornecedores.id, { onDelete: "cascade" }),
    skuFornecedor: text("sku_fornecedor"),
    linkItem: text("link_item"),
    preco: dinheiro("preco"),
    prazoValor: quantidade("prazo_valor"),
    prazoUnidade: unidadePrazo("prazo_unidade").notNull().default("dias"),
    qtdMinima: quantidade("qtd_minima"),
    unidadeMinimaId: uuid("unidade_minima_id").references(() => unidades.id, {
      onDelete: "set null",
    }),
    status: statusFornecedor("status").notNull().default("em_avaliacao"),
    observacoes: text("observacoes"),
    principal: boolean("principal").notNull().default(false),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [unique("item_fornecedor_unico").on(t.itemId, t.fornecedorId)],
);

/* -------------------------------------------------------------------------
 * Estrutura (BOM)
 * ---------------------------------------------------------------------- */

/* -------------------------------------------------------------------------
 * Estrutura — molde e montagem
 *
 * Duas coisas separadas de proposito, e a separacao e o coracao do modulo:
 *
 *   o molde  e o que o equipamento E. Divisoes e pecas com quantidade.
 *            estavel, reutilizavel, e nao encosta no estoque nunca.
 *   a montagem  e o que esta sendo feito agora. Nasce como copia do molde,
 *            uma arvore por equipamento, e e ela que da baixa no estoque.
 *
 * Montar tres equipamentos abre tres arvores independentes — cada uma no seu
 * quadrado, montada no seu ritmo, sem contador de "2 de 3" e sem uma afetar a
 * outra. A copia tambem e o que protege o passado: editar o molde depois nao
 * reescreve o que ja foi montado.
 *
 * Divisao e equipamento sao desta tela. Item de estoque e o unico que
 * atravessa a fronteira, e so no momento de montar.
 * ---------------------------------------------------------------------- */

/** Nomes livres de divisao: Domo, Estrutura, Fiacao, Fixacao. */
export const divisoes = pgTable("divisoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  ordem: integer("ordem").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm,
  criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
});

export const moldes = pgTable("moldes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  descricao: text("descricao"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm,
  criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoPor: uuid("atualizado_por").references(() => usuarios.id, { onDelete: "set null" }),
});

/**
 * Um no do molde e uma de duas coisas, nunca as duas:
 *   divisaoId  → agrupador, pode ter filhos
 *   itemId     → peca do estoque, folha
 */
export const moldeNos = pgTable("molde_nos", {
  id: uuid("id").primaryKey().defaultRandom(),
  moldeId: uuid("molde_id")
    .notNull()
    .references(() => moldes.id, { onDelete: "cascade" }),
  paiId: uuid("pai_id").references((): AnyPgColumn => moldeNos.id, { onDelete: "cascade" }),
  divisaoId: uuid("divisao_id").references(() => divisoes.id, { onDelete: "restrict" }),
  itemId: uuid("item_id").references(() => itens.id, { onDelete: "restrict" }),
  quantidade: quantidade("quantidade"),
  obrigatorio: boolean("obrigatorio").notNull().default(true),
  localMontagem: text("local_montagem"),
  ordem: integer("ordem").notNull().default(0),
});

/* -------------------------------------------------------------------------
 * Compras: cotacao -> pedido -> recebimento
 * ---------------------------------------------------------------------- */

export const cotacoes = pgTable("cotacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  numero: text("numero").notNull().unique(),
  titulo: text("titulo").notNull(),
  status: statusCotacao("status").notNull().default("rascunho"),
  observacoes: text("observacoes"),
  criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
  criadoEm,
});

export const cotacaoItens = pgTable(
  "cotacao_itens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cotacaoId: uuid("cotacao_id")
      .notNull()
      .references(() => cotacoes.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => itens.id, { onDelete: "restrict" }),
    quantidade: quantidade("quantidade"),
  },
  /* Colunas em ordem decrescente de nome, e nao na ordem "natural": e assim
     que o drizzle-kit le uma unique composta do banco, e declarar diferente
     fazia todo `db:push` querer recriar a constraint (oferecendo truncar a
     tabela). Unicidade de um par nao depende de ordem. */
  (t) => [unique("cotacao_item_unico").on(t.itemId, t.cotacaoId)],
);

/* Um preco por fornecedor por item cotado. E a matriz do comparativo. */
export const cotacaoPrecos = pgTable(
  "cotacao_precos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cotacaoItemId: uuid("cotacao_item_id")
      .notNull()
      .references(() => cotacaoItens.id, { onDelete: "cascade" }),
    fornecedorId: uuid("fornecedor_id")
      .notNull()
      .references(() => fornecedores.id, { onDelete: "cascade" }),
    precoUnitario: dinheiro("preco_unitario"),
    prazoValor: quantidade("prazo_valor"),
    prazoUnidade: unidadePrazo("prazo_unidade").notNull().default("dias"),
    frete: dinheiro("frete"),
    observacao: text("observacao"),
    escolhido: boolean("escolhido").notNull().default(false),
  },
  /* Ordem decrescente de nome — ver a nota em cotacaoItens. */
  (t) => [unique("cotacao_preco_unico").on(t.fornecedorId, t.cotacaoItemId)],
);

export const pedidosCompra = pgTable("pedidos_compra", {
  id: uuid("id").primaryKey().defaultRandom(),
  numero: text("numero").notNull().unique(),
  cotacaoId: uuid("cotacao_id").references(() => cotacoes.id, { onDelete: "set null" }),
  fornecedorId: uuid("fornecedor_id")
    .notNull()
    .references(() => fornecedores.id, { onDelete: "restrict" }),
  status: statusPedido("status").notNull().default("aberto"),
  frete: dinheiro("frete"),
  condicaoPagamento: text("condicao_pagamento"),
  observacoes: text("observacoes"),
  criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
  criadoEm,
});

export const pedidoItens = pgTable("pedido_itens", {
  id: uuid("id").primaryKey().defaultRandom(),
  pedidoId: uuid("pedido_id")
    .notNull()
    .references(() => pedidosCompra.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => itens.id, { onDelete: "restrict" }),
  quantidade: quantidade("quantidade"),
  precoUnitario: dinheiro("preco_unitario"),
  quantidadeRecebida: quantidade("quantidade_recebida"),
  /* Devolvido ao fornecedor. Fica ao lado do recebido, e nao descontando
     dele: a linha foi recebida mesmo, e desfazer isso faria o pedido voltar
     a "aberto" e oferecer receber de novo o que ja voltou. */
  quantidadeDevolvida: quantidade("quantidade_devolvida"),
  /* O que quem compra precisa escolher no site do fornecedor: cor, tamanho,
     voltagem, o kit com 50 em vez do avulso. Fica na linha do pedido, e nao
     no item, porque muda de compra para compra — e e o campo que sai em
     destaque no PDF mandado para o pessoal de compras. */
  parametrosCompra: text("parametros_compra"),
});

/* -------------------------------------------------------------------------
 * Estoque
 * ---------------------------------------------------------------------- */

export const movimentos = pgTable("movimentos", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => itens.id, { onDelete: "cascade" }),
  tipo: tipoMovimento("tipo").notNull(),
  quantidade: quantidade("quantidade"),
  referencia: text("referencia"),
  /* No desktop era texto livre digitado a mao. Agora e quem estava logado. */
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  observacao: text("observacao"),
  /* Preenchido quando o movimento nasceu do recebimento de um pedido. */
  pedidoItemId: uuid("pedido_item_id").references(() => pedidoItens.id, {
    onDelete: "set null",
  }),
  /* Idem para montagem: uma montagem gera a saida de cada componente e a
     entrada do equipamento, e e por este campo que o estorno acha todos. */
  montagemId: uuid("montagem_id").references(() => montagens.id, {
    onDelete: "set null",
  }),
  criadoEm,
});

/* -------------------------------------------------------------------------
 * Frota e montagens
 *
 * A estrutura (bom) e a receita; a montagem e uma unidade que existe de
 * verdade, feita a partir dessa receita. Cada montagem e rastreada uma a uma
 * porque a pergunta que importa e "qual equipamento esta no carro ABC-1234",
 * e nao "quantos equipamentos existem".
 * ---------------------------------------------------------------------- */

export const versoes = pgTable(
  "versoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipo: tipoVersao("tipo").notNull(),
    numero: text("numero").notNull(),
    notas: text("notas"),
    lancadaEm: date("lancada_em"),
    criadoEm,
  },
  /* A mesma numeracao pode existir nos dois tipos: o sistema 3.2 e o app do
     tablet 3.2 sao coisas diferentes. */
  (t) => [unique("versao_unica").on(t.tipo, t.numero)],
);

export const carros = pgTable("carros", {
  id: uuid("id").primaryKey().defaultRandom(),
  placa: text("placa").notNull().unique(),
  fabricante: text("fabricante").notNull(),
  modelo: text("modelo").notNull(),
  /* Identificacao livre do computador de bordo: nome da maquina, patrimonio
     ou numero de serie — o que estiver colado nele. */
  pc: text("pc"),
  versaoSistemaId: uuid("versao_sistema_id").references(() => versoes.id, {
    onDelete: "set null",
  }),
  versaoTabletId: uuid("versao_tablet_id").references(() => versoes.id, {
    onDelete: "set null",
  }),
  criadoEm,
  criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoPor: uuid("atualizado_por").references(() => usuarios.id, { onDelete: "set null" }),
});

/**
 * Uma arvore em montagem: um equipamento, copiado do molde no momento em que
 * a ordem e aberta. Pedir tres equipamentos cria tres linhas destas.
 *
 * `nome` e copia, nao atalho: o molde pode ser renomeado ou apagado depois, e
 * o que foi montado nao muda de nome por causa disso.
 */
export const montagens = pgTable("montagens", {
  id: uuid("id").primaryKey().defaultRandom(),
  numero: text("numero").notNull().unique(),
  moldeId: uuid("molde_id").references(() => moldes.id, { onDelete: "set null" }),
  nome: text("nome").notNull(),
  status: statusMontagem("status").notNull().default("em_montagem"),
  /* Onde a unidade esta enquanto nao tem carro: prateleira, bancada, ou a
     placa escrita a mao de um carro que ainda nao foi cadastrado. */
  local: text("local"),
  /* O campo "equipamento" do carro e este vinculo visto do outro lado. Unico
     porque um carro leva um equipamento; no Postgres varios nulos convivem,
     entao montagem sem carro nao briga com montagem sem carro. */
  carroId: uuid("carro_id")
    .references(() => carros.id, { onDelete: "set null" })
    .unique(),
  observacoes: text("observacoes"),
  iniciadaEm: timestamp("iniciada_em", { withTimezone: true }).notNull().defaultNow(),
  /* So existe quando a arvore inteira fecha — e o que libera associar o carro. */
  montadaEm: timestamp("montada_em", { withTimezone: true }),
  montadaPor: uuid("montada_por").references(() => usuarios.id, { onDelete: "set null" }),
  desmontadaEm: timestamp("desmontada_em", { withTimezone: true }),
});

/**
 * O no da arvore de uma montagem. Copia do no do molde, com o estado.
 *
 * O nome da divisao vem copiado em vez de apontar para `divisoes`: renomear
 * "Domo" amanha nao pode reescrever o que foi montado ontem. A peca continua
 * apontando para o item, porque e do item que sai o saldo.
 *
 * `montadoEm` preenchido e o congelamento: dali em diante o no nao se mexe.
 */
export const montagemNos = pgTable("montagem_nos", {
  id: uuid("id").primaryKey().defaultRandom(),
  montagemId: uuid("montagem_id")
    .notNull()
    .references(() => montagens.id, { onDelete: "cascade" }),
  paiId: uuid("pai_id").references((): AnyPgColumn => montagemNos.id, { onDelete: "cascade" }),
  /* Divisao: nome copiado. Peca: itemId. Nunca os dois. */
  nome: text("nome"),
  itemId: uuid("item_id").references(() => itens.id, { onDelete: "restrict" }),
  quantidade: quantidade("quantidade"),
  obrigatorio: boolean("obrigatorio").notNull().default(true),
  localMontagem: text("local_montagem"),
  ordem: integer("ordem").notNull().default(0),
  montadoEm: timestamp("montado_em", { withTimezone: true }),
  montadoPor: uuid("montado_por").references(() => usuarios.id, { onDelete: "set null" }),
});

/* -------------------------------------------------------------------------
 * Auditoria — com duas pessoas na mesma base, saber quem mexeu importa.
 * ---------------------------------------------------------------------- */

export const logAuditoria = pgTable("log_auditoria", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  tabela: text("tabela").notNull(),
  registroId: text("registro_id").notNull(),
  acao: acaoAuditoria("acao").notNull(),
  dadosAntes: jsonb("dados_antes"),
  dadosDepois: jsonb("dados_depois"),
  criadoEm,
});
