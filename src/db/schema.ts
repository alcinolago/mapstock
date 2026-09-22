import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
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

/* Aquisicao, origem de fabricacao e material 3D eram enums aqui. Viraram
   cadastro (tabelas mais abaixo) porque toda lista que o cadastro de item
   oferece num select tem de ser editavel em Configuracoes — acrescentar
   "Comodato" nao pode exigir migracao de banco. */

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

/* Montagem so tem dois estados: aberta ou fechada. Nao existe desmontar —
   enquanto nada foi montado a montagem se exclui, e depois de montada ela
   virou movimento no estoque e nao volta atras. */
export const statusMontagem = pgEnum("status_montagem", ["montada", "em_montagem"]);

export const acaoAuditoria = pgEnum("acao_auditoria", ["criar", "atualizar", "excluir"]);

/*
 * Dinheiro e quantidade em numeric (exato no banco) lido como number no TS.
 *
 * O zero vai como SQL literal, e nao como `.default(0)`, por causa do
 * comparador do drizzle-conjunto: ele le o default de uma coluna numeric do banco
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

/* bytea nao vem pronto no drizzle. O driver do Neon ja devolve Buffer na
   leitura e aceita Buffer na escrita, entao o tipo so precisa dizer ao banco
   como a coluna se chama. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

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

/**
 * As listas que o cadastro de item oferece nos selects.
 *
 * Todas com a mesma forma — nome, ordem, ativo — e todas editaveis em
 * Configuracoes. Item aponta para a linha; apagar linha em uso e barrado, e
 * o caminho e desativar, que a tira dos selects sem mexer no que ja foi
 * cadastrado.
 */
export const aquisicoes = pgTable("aquisicoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  ordem: integer("ordem").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
});

export const origensFabricacao = pgTable("origens_fabricacao", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  /* Substitui a lista ORIGENS_3D, que era fixa no codigo: e esta marca que
     abre o bloco de parametros de impressao no cadastro do item. Sem ela,
     criar uma origem nova de impressao exigiria mexer em codigo. */
  abreParametros3d: boolean("abre_parametros_3d").notNull().default(false),
  ordem: integer("ordem").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
});

export const materiais3d = pgTable("materiais_3d", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  ordem: integer("ordem").notNull().default(0),
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
  aquisicaoId: uuid("aquisicao_id").references(() => aquisicoes.id, { onDelete: "restrict" }),
  origemFabricacaoId: uuid("origem_fabricacao_id").references(() => origensFabricacao.id, {
    onDelete: "restrict",
  }),
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

/**
 * Fotos do item, no maximo tres, guardadas no proprio banco.
 *
 * O arquivo vem compactado do navegador (ver src/lib/imagem.ts): a foto de
 * celular de 4 MB chega aqui com ~200 KB, senao guardar binario no Postgres
 * nao se sustentaria. JPEG e nao WebP porque a mesma foto precisa entrar no
 * PDF do pedido, e o pdf-lib so embute JPEG e PNG.
 *
 * A linha e imutavel: trocar uma foto e apagar e inserir outra. E o que deixa
 * /api/fotos/<id> responder com cache eterno.
 */
export const itemFotos = pgTable("item_fotos", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => itens.id, { onDelete: "cascade" }),
  dados: bytea("dados").notNull(),
  /* Copia de ~200px, uns 10 KB. A lista de itens e o seletor mostram esta: a
     foto inteira ali dentro faria uma tela de 20 linhas puxar megabytes. */
  miniatura: bytea("miniatura").notNull(),
  tipo: text("tipo").notNull(),
  ordem: integer("ordem").notNull().default(0),
  criadoEm,
  criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
});

/* No desktop estes campos eram concatenados como texto no fim das
   observacoes, dentro de um marcador [PARAMETROS_3D]. */
export const itensParametros3d = pgTable("itens_parametros_3d", {
  itemId: uuid("item_id")
    .primaryKey()
    .references(() => itens.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").references(() => materiais3d.id, { onDelete: "restrict" }),
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
 * Estrutura — molde e montagem
 *
 * O molde e uma arvore de divisoes e pecas. Ele serve a duas coisas, e a
 * diferenca entre elas e uma coluna so:
 *
 *   sem itemId  e o manual do equipamento completo. Documentacao de bancada:
 *               mostra o que entra num equipamento e onde cada coisa vai.
 *               Nao monta, nao consome, nao produz nada.
 *   com itemId  e a receita de um item do estoque — o conjunto. Montar um conjunto
 *               consome as pecas da arvore e da entrada de UMA unidade do
 *               item apontado.
 *
 * O conjunto e o que destrava a bancada. O domo e um item como qualquer outro:
 * quem monta faz seis domos na segunda porque chegaram as cameras, e eles
 * ficam na prateleira esperando o resto. Sem isso, nada podia ser montado
 * antes de o equipamento inteiro estar comprado.
 *
 * Duas tentativas anteriores de fazer o equipamento completo virar item
 * quebraram no mesmo ponto: obrigavam a cadastrar "Domo" no estoque. A saida
 * foi inverter — o domo E um item, porque encosta na prateleira montado; o
 * equipamento completo nao e, porque so existe instalado.
 *
 * A montagem e a execucao: nasce como copia da arvore do molde (editar o
 * molde amanha nao pode reescrever o que foi montado ontem), vale por UMA
 * unidade e fecha de uma vez so. Dois domos sao duas montagens, cada uma
 * conferindo o estoque no momento do proprio clique.
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
  /* Preenchido = receita de um item do estoque (conjunto). Vazio = manual de um
     equipamento completo, que nao vira item nenhum. Unico porque um item tem
     uma receita so: mudou o domo, edita a estrutura dele. */
  itemId: uuid("item_id")
    .references(() => itens.id, { onDelete: "restrict" })
    .unique(),
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
     que o drizzle-conjunto le uma unique composta do banco, e declarar diferente
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
     voltagem, o conjunto com 50 em vez do avulso. Fica na linha do pedido, e nao
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
  /* Idem para montagem: montar um conjunto gera a saida de cada peca da arvore e
     a entrada de uma unidade do item produzido, todas com este campo. */
  montagemId: uuid("montagem_id").references(() => montagens.id, {
    onDelete: "set null",
  }),
  criadoEm,
});

/**
 * Uma unidade sendo montada: sempre UMA, nunca um lote.
 *
 * `itemId` e o item que sai pronto — e o que diferencia esta tabela de uma
 * lista de tarefas. `nome` e `montagem_nos.nome` sao copia, nao atalho: o
 * molde pode ser renomeado ou apagado depois, e o que foi montado nao muda
 * de nome por causa disso.
 *
 * Seis domos sao seis linhas destas. Nao existe contador de "2 de 6": cada
 * uma confere o estoque no momento do proprio clique, e quem clicar primeiro
 * leva as pecas.
 */
export const montagens = pgTable("montagens", {
  id: uuid("id").primaryKey().defaultRandom(),
  numero: text("numero").notNull().unique(),
  moldeId: uuid("molde_id").references(() => moldes.id, { onDelete: "set null" }),
  /* O item que esta montagem produz. Copiado do molde na abertura. */
  itemId: uuid("item_id")
    .notNull()
    .references(() => itens.id, { onDelete: "restrict" }),
  nome: text("nome").notNull(),
  status: statusMontagem("status").notNull().default("em_montagem"),
  /* Onde a unidade esta sendo feita: prateleira, bancada, quem esta com ela. */
  local: text("local"),
  observacoes: text("observacoes"),
  iniciadaEm: timestamp("iniciada_em", { withTimezone: true }).notNull().defaultNow(),
  montadaEm: timestamp("montada_em", { withTimezone: true }),
  montadaPor: uuid("montada_por").references(() => usuarios.id, { onDelete: "set null" }),
});

/**
 * O no da arvore de uma montagem. Copia do no do molde.
 *
 * Nao tem estado proprio: a montagem fecha inteira de uma vez, entao nao
 * existe no meio-montado. O que este no guarda e o registro de com o que
 * aquela unidade foi feita, congelado na abertura.
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
  localMontagem: text("local_montagem"),
  ordem: integer("ordem").notNull().default(0),
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
