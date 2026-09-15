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
src/lib/sessao.ts       JWT + cookie          src/lib/auth.ts  guardas de página
src/lib/acoes/*         server actions, uma por módulo
src/proxy.ts            proteção de rota (era `middleware` até o Next 15)
src/components/ui/*     primitivos: Botao, Entrada, Cartao, Selo, Tabela
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
  gravado. Quantidade inicial e recebimento de pedido viram movimento.
- **Movimento não se apaga, se estorna** (lança o oposto).
- **Nível 0 é o equipamento montado**: não se movimenta e nunca conta falta.
- **Toda server action que escreve chama `exigirEdicao()`** (ou `exigirAdmin()`)
  e registra em `logAuditoria` via `registrar()`.

## Cores

Nunca use cor literal nem classe `slate-*`/`sky-*` do Tailwind. Use os tokens
de `globals.css`: `bg-superficie`, `text-texto-fraco`, `border-borda`,
`text-marca`, `bg-ok-suave`. Todos existem no tema claro **e** no escuro — uma
cor definida só num dos dois quebra o outro.

## Antes de entregar

```bash
npx tsc --noEmit && npx eslint src && npm run build
```
