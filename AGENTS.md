# MapStock — orientações para trabalhar neste código

Sistema de estoque e compras da Mapzer. Reescrita web do `MPZ-ERP-V35.pyw`
(Tkinter + SQLite), que está preservado em `legado/` — vale consultar quando
surgir dúvida sobre regra de negócio.

## Convenções

- **Todo o código é em português**: nomes de arquivo, variáveis, funções,
  componentes, colunas e tabelas. `Botao`, `salvarItem`, `itemFornecedores`.
  A única exceção são as APIs do framework (`useState`, `searchParams`).
- **Comentários explicam o porquê**, não o quê. Vários deles apontam para a
  decisão original no sistema desktop — mantenha esse fio.
- **Sem acento em chave de enum.** O banco guarda `entrada_fabricacao`; o
  rótulo `"Entrada fabricação"` vive em `src/lib/labels.ts`. Isso existe por
  causa de um bug real do sistema antigo, em que comparar string acentuada
  escrita à mão fazia movimentações sumirem do saldo.
- **Enum é para o que o código decide; lista é para o que o usuário decide.**
  Tipo de movimento e status de pedido são enum porque existe código que se
  ramifica em cada valor. Aquisição, origem de fabricação e material de
  impressão eram enum e viraram tabela: ninguém deve precisar de migração de
  banco para acrescentar "Comodato".

## Estrutura

```
src/db/schema.ts        tabelas e enums (fonte da verdade do modelo)
src/db/consultas.ts     consultas compartilhadas, incluindo o saldo agregado
src/db/seed.ts          configurações padrão + admin
src/db/demo.ts          dados de demonstração
src/lib/labels.ts       chave ASCII → rótulo em português; EFEITO_MOVIMENTO
src/lib/codigo.ts       sugestão de código e classificação (portado do desktop)
src/lib/imagem.ts       compactação da foto no navegador (MB → KB)
src/lib/mapa.ts         endereço do fornecedor → link de rota
src/lib/acoes/moldes.ts     estrutura (manual e conjunto)  src/lib/acoes/montagem.ts  execução
src/lib/acoes/divisoes.ts   os nomes das divisões, reutilizáveis entre estruturas
src/lib/estrutura.ts    árvore das estruturas, com os conjuntos abertos (tela e PDF)
src/lib/sessao.ts       JWT + cookie          src/lib/auth.ts  guardas de página
src/lib/acoes/*         server actions, uma por módulo
src/lib/pdf.ts          montagem de PDF (A4, quebra de linha, link clicável)
src/proxy.ts            proteção de rota (era `middleware` até o Next 15)
src/components/ui/*     primitivos: Botao, Entrada, CampoSenha, Cartao, Selo, Tabela, Modal
```

## O sistema é colaborativo

Tudo que é cadastrado é visível para todo mundo que tem acesso. **Nenhuma
consulta de listagem filtra por usuário** — `criadoPor`, `atualizadoPor` e
`movimentos.usuarioId` existem só para mostrar quem fez e alimentar a
auditoria, nunca para esconder dado de ninguém.

O que varia entre pessoas é permissão de ação (`exigirEdicao`, `exigirAdmin`),
não visibilidade. Se algum dia aparecer um `where` contra usuário numa
listagem, é bug.

## Regras que não podem quebrar

- **`EFEITO_MOVIMENTO` (labels.ts) e o `CASE` do saldo (consultas.ts) espelham
  um ao outro.** Tipo de movimento novo exige mudar os dois.
- **Saldo é sempre a soma do histórico de `movimentos`** — nunca um campo
  gravado. Entrada inicial (lançada na tela de Estoque) e recebimento de
  pedido viram movimento.
- **Movimento não se apaga, se estorna** (lança o oposto).
- **Devolver ao fornecedor não desfaz o recebimento.** `devolucao_compra` é um
  movimento novo que tira do saldo; `pedidoItens.quantidadeDevolvida` fica ao
  lado de `quantidadeRecebida`, nunca descontando dela — zerar o recebido
  faria o pedido voltar a "aberto" e oferecer receber o que já voltou.
- **Excluir só trava no que é documento.** Item bloqueia por cotação, pedido,
  montagem ou vínculo na estrutura; fornecedor, por preço cotado ou pedido.
  Movimentação avulsa e vínculo de preço vão junto na exclusão, com o antes
  guardado em `logAuditoria`. Quem não pode ser excluído se desativa. A regra
  vive em `dependenciasItem` / `dependenciasFornecedor`, e a tela mostra a
  contagem antes de confirmar (`components/exclusao/botao-excluir.tsx`).
- **Custo unitário do item não é digitado**: vem do recebimento do pedido
  (`acoes/compras.ts`). O cadastro de item não tem esse campo.
- **Código de item é prefixo da classificação mais um sequencial** —
  `FIX-0001`, `AUT-0003` —, montado por `gerarCodigo` (`acoes/itens.ts`) e
  sem nenhum campo na tela. Não tente devolver inteligência a ele. Já foi
  assim duas vezes: um gerador montava o código a partir de palavras da
  descrição (PARAFUSO → PAR, M6x20 → M6X20) e o campo ficava editável com um
  botão de regerar. O vocabulário nunca cobria o catálogo real — metade das
  peças caía no prefixo sozinho —, e entre isso e a edição à mão o cadastro
  acumulou `FIX-ARR-01`, `FIX-POR-ATM6`, `FIX-PAR-AAB8-0016`, `CON` e
  `CON-01` lado a lado. Número corrido não tenta dizer o que a peça é; quem
  diz isso é a descrição, que está ao lado em toda tela.
- **O sequencial conta a partir do maior em uso, não da quantidade de itens.**
  Apagar um item não pode fazer o próximo reaproveitar um código que já saiu
  impresso.
- **O código não se regera na edição** — ele já saiu em pedido, em PDF e na
  etiqueta da gaveta, então corrigir a descrição não pode trocar a identidade
  da peça. Trocar a classificação também não renumera.
- **O custo exibido é derivado, não lido de `itens.custoUnitario`.** Quem
  manda é o preço do último `entrada_compra` até a data (`custoAte`, em
  `consultas.ts`), seguindo `movimentos.pedidoItemId` até
  `pedidoItens.precoUnitario` — que, ao contrário do campo, não é
  sobrescrito. Com o campo sozinho, qualquer caminho que criasse movimento
  sem passar por `receberItemDoPedido` o deixava parado no tempo, e a posição
  retroativa ainda valorizava a quantidade de agosto pelo preço de hoje.
  `itens.custoUnitario` continua sendo gravado e vale de reserva para o item
  que nunca foi comprado (fabricado, impresso). O conjunto não usa nem isso: o
  custo dele é a soma das peças, calculada na hora de exibir.
- **A estrutura tem dois sabores, e a diferença é `moldes.itemId`.**
  Vazio é o **manual** de um equipamento completo: documentação de bancada,
  não vira item, não tem saldo, não passa pela Montagem. Preenchido é o
  **conjunto** — a receita de um item do estoque. A tela de Estrutura mostra os
  dois separados por uma linha, equipamentos em cima e itens embaixo.
- **Uma palavra só: conjunto.** O item que se monta a partir de outros é
  *conjunto*, nunca *kit*. Havia os dois no sistema — "kit" era ao mesmo tempo
  unidade de medida e tipo de item, e na linha do domo apareciam `1 kit` e o
  selo `kit` dizendo coisas diferentes. A unidade "kit" foi removida e os
  itens dela passaram para `conj.`.
- **O conjunto é um item comum**, cadastrado na tela de Itens como qualquer outro.
  Não existe campo "é conjunto": o que faz dele um conjunto é existir uma estrutura
  apontando para ele, e um item tem uma receita só (`moldes.itemId` é único).
  Foi isso que destravou a bancada — dá para montar seis domos na segunda
  porque chegaram as câmeras, sem esperar o equipamento inteiro ser comprado.
  Houve duas tentativas de fazer o **equipamento completo** virar item
  (`bom`, e depois `itens.papel`); as duas quebraram por obrigar a cadastrar
  algo que não encosta na prateleira. O domo encosta, e por isso é item.
- **O conjunto não tem preço.** Quem tem preço são as peças. O custo que aparece
  na Estrutura é a soma da árvore, e nada é gravado em `itens.custoUnitario`
  do item produzido. Cotar um domo é cotar as peças do domo (`explodirMolde`,
  origem `estrutura` em `criarCotacao`).
- **O manual abre os conjuntos que usa, e não deixa editá-los ali.** Quando uma
  peça do equipamento tem estrutura própria, a árvore dela aparece embaixo
  marcada com `doConjunto` — sem adicionar, remover ou reordenar. O equipamento
  aponta para o domo; quem define o domo é a estrutura do domo. Editar pelos
  dois lados é como um deles fica errado. Vale em qualquer lugar onde um conjunto
  entre como peça, inclusive conjunto dentro de conjunto.
- **A árvore aberta mostra a receita, não o total.** Dois domos no equipamento
  continuam mostrando 4 câmeras, que é o que entra em *um* domo — o bloco é
  cópia fiel do que está na seção Itens, que é para onde a pessoa vai quando
  quiser mudar. Multiplicar faria os dois discordarem na cara dela.
- **Estrutura é planejamento; montagem é execução.** Criar estrutura,
  acrescentar divisão, mudar quantidade — nada disso confere saldo nem pode
  ser barrado por falta. Quem confere estoque é `montarMontagem`, e só ele.
- **Divisão é só agrupamento de leitura.** Não se monta, não tem estado, não
  aparece no estoque. Serve para a árvore ser legível.
- **Abrir uma montagem copia a árvore da estrutura para dentro dela**
  (`abrirMontagem`). A cópia não é otimização: editar a receita amanhã não
  pode reescrever com o que aquela unidade foi feita ontem. O nome da divisão
  vai copiado em `montagem_nos.nome` pelo mesmo motivo. Estrutura não tem
  versão — receita nova é estrutura nova.
- **Cada montagem vale por UMA unidade e fecha de uma vez só.** Seis domos
  são seis montagens; não existe campo de quantidade nem contador de "2 de
  6". Cada uma confere o saldo no momento do próprio clique, sem reserva e
  sem repartir estoque entre as abertas: quem clicar primeiro leva as peças,
  e a seguinte passa a acusar falta. Foi decisão explícita de quem monta.
- **Montar é o único caminho entre esta tela e o estoque, e ele anda nos dois
  sentidos**: `saida_producao` de cada peça da árvore (quantidade multiplicada
  nível a nível) e `entrada_fabricacao` de uma unidade do item produzido.
- **Montada sai da tela de Montagem e vai para o histórico**
  (`/montagem/historico`). Montada não tem ação nenhuma, então misturada com
  as abertas ela só empurrava para baixo o que ainda tem trabalho — e a tela
  crescia uma linha por unidade feita desde sempre. `/montagem` é lista de
  trabalho pendente; o histórico é consulta, com recorte por período.
- **Árvore nasce recolhida, nas duas telas.** Em Estrutura o cartão abre
  mostrando só as divisões — o desenho do equipamento —, e quem quer o
  detalhe pede; uma divisão sozinha pode trazer a árvore inteira de outro
  item, quando tem conjunto dentro. Em Montagem a árvore fica atrás de um
  "Ver N peças": com meia dúzia de unidades abertas, seis árvores empilhadas
  viram uma parede e some o que importa, que é qual delas dá para montar
  agora. Quem acabou de acrescentar algo dentro de uma divisão vê ela abrir
  (`aoAdicionar`), senão o clique parece não ter feito nada.
- **Montagem montada não volta atrás.** Não existe desmontar: enquanto está
  aberta ela se exclui; depois de montada virou movimento, e movimento não se
  apaga.
- **Não existe frota.** Rastrear qual equipamento está em qual carro é
  controle de ativo instalado, não de estoque, e foi removido de propósito —
  com ele saíram `carros`, `versoes` e o vínculo montagem↔carro.
- **Foto de item é JPEG, e são duas cópias.** O navegador compacta antes de
  enviar (`src/lib/imagem.ts`): sem isso, guardar binário no Postgres não se
  sustentaria — a foto do celular tem 4 MB e chega ao banco com ~200 KB. JPEG
  e não WebP porque a mesma foto entra no PDF do pedido, e o `pdf-lib` só
  embute JPEG e PNG. A segunda cópia é a miniatura (260px, ~14 KB): é ela que
  a lista, o seletor e o PDF carregam — a foto inteira num quadrado de 32px
  faria uma página de 50 itens puxar megabytes.
- **A linha de `item_fotos` é imutável**: trocar uma foto é apagar e inserir
  outra. É o que deixa `/api/fotos/<id>` responder com cache eterno.
- **Máximo de 3 fotos, e elas vão no mesmo envio do cadastro.** Por isso
  `serverActions.bodySizeLimit` está em 2 MB no `next.config.ts` — o padrão de
  1 MB estoura com três fotos mais as miniaturas.
- **Todo select do cadastro de item tem cadastro em Configurações**, com
  criar, editar e remover: classificação (com as palavras-chave), unidade,
  local, aquisição, origem de fabricação e material de impressão 3D. Nenhuma
  delas é lista fixa no código — o que está em `src/db/seed.ts` é só o ponto
  de partida. Se aparecer um `<Selecao>` novo no cadastro de item alimentado
  por um array em `.ts`, falta a tela dele.
- **Remover opção em uso é barrado; o caminho é desativar.** A opção
  desativada some dos selects e continua valendo no que já foi cadastrado.
  É por isso que `itens` aponta para essas listas com `restrict`.
- **Quem abre o bloco de parâmetros 3D é a origem escolhida**
  (`origens_fabricacao.abreParametros3d`), não uma lista de origens no
  código. Cadastrar uma impressora nova não pode exigir deploy. A tela e a
  action `salvarItem` leem a mesma marca — a action confere de novo, porque
  o formulário pode chegar dizendo outra coisa.
- **Toda server action que escreve chama `exigirEdicao()`** (ou `exigirAdmin()`)
  e registra em `logAuditoria` via `registrar()`.

## Confirmar antes de agir

Nada de `confirm()` nem `alert()` do navegador para decisão: use
`<BotaoConfirmar>` de `components/ui/confirmar.tsx` (ou `<BotaoExcluir>`,
que além disso conta os vínculos). Os dois montam o mesmo `<Modal>`, então a
janela é igual em toda a aplicação, e o erro da ação volta **para dentro** da
janela em vez de um alerta solto.

O `<Modal>` sai num portal para o `<body>`, e isso não é preferência:
`position: fixed` deixa de valer pela janela quando um ancestral tem
`transform`, `filter` ou `backdrop-filter`. A barra fixa de salvar do cadastro
de item usa `backdrop-blur` — sem o portal, a modal aberta dali nasce presa
dentro dela.

## Campos de senha

Sempre `<CampoSenha>` de `components/ui/campo-senha.tsx`, nunca um
`<Entrada type="password">` solto — é ele que traz o olhinho de mostrar e
ocultar, igual nas três telas que pedem senha.

## Largura das telas

**A página não escolhe a própria largura.** Quem define é o `<main>` da
`Casca` (`components/layout/casca.tsx`): `max-w-[100rem]`, e toda tela ocupa
isso. Antes cada página trazia o seu `max-w-*` — 7xl aqui, 4xl ali, 3xl
acolá — e o sistema parecia feito por três pessoas: a lista de itens ia de
ponta a ponta e a de fornecedores ficava numa ilha no meio do monitor.

A única exceção é **formulário**, que se estreita por dentro com
`mx-auto max-w-5xl`: campo de texto de 1600px não se lê. São as telas de
novo/editar item, novo/editar fornecedor, nova cotação e a conta. Lista,
tabela, árvore e painel nunca estreitam.

## Cores

Nunca use cor literal nem classe `slate-*`/`sky-*` do Tailwind. Use os tokens
de `globals.css`: `bg-superficie`, `text-texto-fraco`, `border-borda`,
`text-marca`, `bg-ok-suave`. Todos existem no tema claro **e** no escuro — uma
cor definida só num dos dois quebra o outro.

## Banco

`npm run db:push` tem que terminar em **`No changes detected`**. Se ele listar
statements, alguma coisa divergiu — não responda "sim" sem ler, porque quando
há dado na tabela ele oferece **truncar**.

Duas convenções existem só para o push continuar limpo, e desfazer qualquer
uma traz o ruído de volta:

- **Unique composta se declara com as colunas em ordem decrescente de nome**
  (`.on(t.itemId, t.cotacaoId)`), que é a ordem em que o drizzle-conjunto lê do
  banco. Unicidade de um par não depende de ordem.
- **Default numérico vai como `sql`'0'``** (o helper `zero` em schema.ts), e
  não `.default(0)`: o comparador lê o default do banco como string.

**Subconsulta correlacionada precisa do helper `ref()`** (`consultas.ts`). Na
lista de seleção o drizzle renderiza `${tabela.coluna}` **sem o nome da
tabela** — vira só `"id"`. Dentro de uma subconsulta isso passa a ser
resolvido pela tabela de dentro, que quase sempre também tem `id`, e a
correlação vira `n.molde_id = n.id`. Não dá erro: a consulta roda e devolve
zero para tudo. Já derrubou a tela de Montagem ("nenhuma estrutura", com dois
moldes cheios) e deixou `emUso` das versões zerado por semanas.

Constraint criada fora do drizzle também diverge — ele espera
`<tabela>_<coluna>_unique` e `<tabela>_<coluna>_<ref>_<refcol>_fk`, não o
`_key`/`_fkey` que o Postgres dá sozinho.

## Antes de entregar

```bash
npx tsc --noEmit && npx eslint src && npm run build
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
