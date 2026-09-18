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

## Estrutura

```
src/db/schema.ts        tabelas e enums (fonte da verdade do modelo)
src/db/consultas.ts     consultas compartilhadas, incluindo o saldo agregado
src/db/seed.ts          configurações padrão + admin
src/db/demo.ts          dados de demonstração
src/lib/labels.ts       chave ASCII → rótulo em português; EFEITO_MOVIMENTO
src/lib/codigo.ts       sugestão de código e classificação (portado do desktop)
src/lib/acoes/moldes.ts     molde (receita)     src/lib/acoes/montagem.ts  execução
src/lib/acoes/divisoes.ts   os nomes das divisões, reutilizáveis entre moldes
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
- **O custo exibido é derivado, não lido de `itens.custoUnitario`.** Quem
  manda é o preço do último `entrada_compra` até a data (`custoAte`, em
  `consultas.ts`), seguindo `movimentos.pedidoItemId` até
  `pedidoItens.precoUnitario` — que, ao contrário do campo, não é
  sobrescrito. Com o campo sozinho, qualquer caminho que criasse movimento
  sem passar por `receberItemDoPedido` o deixava parado no tempo, e a posição
  retroativa ainda valorizava a quantidade de agosto pelo preço de hoje.
  `itens.custoUnitario` continua sendo gravado e vale de reserva para o item
  que nunca foi comprado (fabricado, impresso, equipamento montado).
- **Estrutura e estoque são mundos separados, e a fronteira é o item.**
  `moldes`/`molde_nos` e `montagens`/`montagem_nos` são desta parte do sistema:
  equipamento e divisão existem só aqui, nunca viram item, nunca têm saldo e
  nunca aparecem em Estoque ou Itens. O único que atravessa é a **peça**, que
  é um item de verdade — e ela atravessa num momento só: ao montar.
  Já houve duas tentativas de fazer o equipamento ser item (`bom`, e depois
  `itens.papel` com Equipamento/Conjunto/Peça). As duas quebraram no mesmo
  ponto: obrigavam a cadastrar "Domo" no estoque.
- **Molde é planejamento; montagem é execução.** Criar molde, acrescentar
  divisão, mudar quantidade — nada disso confere saldo nem pode ser barrado
  por falta. Quem confere estoque é `montarNo`, e só ele.
- **Abrir uma montagem copia a árvore do molde para dentro dela**
  (`abrirMontagens`). A cópia não é otimização: editar o molde amanhã não
  pode reescrever o que já foi montado ontem. O nome da divisão vai copiado
  em `montagem_nos.nome` pelo mesmo motivo. Molde não tem versão — receita
  nova é molde novo.
- **Três equipamentos são três árvores independentes**, cada uma com seu
  número, montada no seu ritmo. Não existe contador de "2 de 3": foi decisão
  explícita de quem monta.
- **Só divisão se monta.** Peça não se monta — ela é consumida quando a
  divisão que a contém fecha. `montadoEm` preenchido congela o nó.
- **Montar é o único caminho entre esta tela e o estoque**, e ele só lança
  saída das peças. O equipamento montado **não** dá entrada no estoque:
  ele não é item. Instalar num carro também não movimenta nada.
- **Montar uma divisão consome os filhos diretos dela**: as peças saem do
  estoque, e as sub-divisões precisam já estar montadas. Concluir o
  equipamento (`montarNo` com nó nulo) fecha a raiz e libera o carro.
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
  (`.on(t.itemId, t.cotacaoId)`), que é a ordem em que o drizzle-kit lê do
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
