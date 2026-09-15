import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
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

export const acaoAuditoria = pgEnum("acao_auditoria", ["criar", "atualizar", "excluir"]);

/* Dinheiro e quantidade em numeric (exato no banco) lido como number no TS. */
const dinheiro = (nome: string) =>
  numeric(nome, { precision: 14, scale: 4, mode: "number" }).notNull().default(0);
const quantidade = (nome: string) =>
  numeric(nome, { precision: 14, scale: 4, mode: "number" }).notNull().default(0);

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

export const niveis = pgTable("niveis", {
  num: integer("num").primaryKey(),
  nome: text("nome").notNull(),
});

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
  nivel: integer("nivel")
    .notNull()
    .default(0)
    .references(() => niveis.num, { onDelete: "restrict" }),
  aquisicao: tipoAquisicao("aquisicao"),
  origemFabricacao: origemFabricacao("origem_fabricacao"),
  linkCompra: text("link_compra"),
  prazoValor: quantidade("prazo_valor"),
  prazoUnidade: unidadePrazo("prazo_unidade").notNull().default("dias"),
  custoUnitario: dinheiro("custo_unitario"),
  /* Nao existia no desktop. E o que permite o alerta de reposicao. */
  estoqueMinimo: quantidade("estoque_minimo"),
  localizacao: text("localizacao"),
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

export const bom = pgTable(
  "bom",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paiId: uuid("pai_id")
      .notNull()
      .references(() => itens.id, { onDelete: "cascade" }),
    filhoId: uuid("filho_id")
      .notNull()
      .references(() => itens.id, { onDelete: "cascade" }),
    quantidade: quantidade("quantidade"),
    obrigatorio: boolean("obrigatorio").notNull().default(true),
    localMontagem: text("local_montagem"),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [unique("bom_vinculo_unico").on(t.paiId, t.filhoId)],
);

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
  (t) => [unique("cotacao_item_unico").on(t.cotacaoId, t.itemId)],
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
  (t) => [unique("cotacao_preco_unico").on(t.cotacaoItemId, t.fornecedorId)],
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
  criadoEm,
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
