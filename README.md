# MapStock

Controle de estoque, estrutura de produto e compras da Mapzer.

Substitui o `MPZ-ERP-V35.pyw` (Tkinter + SQLite local, preservado em `legado/`).
A diferença que motivou a reescrita: o banco agora é **um só, no Neon**, então as
duas pessoas trabalham ao mesmo tempo sem zipar e trocar o arquivo `.db`.

## Como rodar

```bash
npm install
cp .env.example .env.local     # cole a connection string do Neon e um AUTH_SECRET
npm run db:push                # cria as tabelas
npm run db:seed                # classificações, unidades, níveis e o usuário admin
npm run dev                    # http://localhost:3000
```

Para gerar um `AUTH_SECRET`: `openssl rand -base64 32`.

### Dados de demonstração

```bash
npm run db:demo            # equipamento completo, com estrutura, estoque, cotação e pedido
npm run db:demo -- limpar  # apaga tudo isso (usuários e configurações ficam)
```

## Deploy na Vercel

1. Importe o repositório na Vercel — ela detecta o Next.js sozinha, não precisa
   mexer em build command nem output directory.
2. Em **Settings → Environment Variables**, adicione:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | a connection string **pooled** do Neon |
   | `AUTH_SECRET` | o mesmo valor usado no `.env.local` |

   O `AUTH_SECRET` precisa ser idêntico entre os ambientes: é o que assina o
   cookie de sessão. Valores diferentes fazem a sessão de um não valer no outro.

3. O `vercel.json` fixa as funções em `gru1` (São Paulo), a mesma região do
   banco no Neon. Sem isso a Vercel roda em `iad1` (Washington) e cada consulta
   vira uma ida e volta de ~200 ms — com várias consultas por tela, a diferença
   é grande. Se um dia o banco mudar de região, mude aqui junto.

> **Atenção:** o `npm run dev` local aponta para o **mesmo banco** da produção.
> É prático para duas pessoas, mas um lançamento de teste feito na sua máquina
> é um lançamento real. Se isso incomodar, crie uma branch no Neon (Branches →
> New branch) e use a connection string dela só no `.env.local`.

## Módulos

| Tela | O que faz |
|---|---|
| **Painel** | Em falta, abaixo do mínimo, valor em estoque, pedidos a receber |
| **Itens** | Cadastro com código e classificação sugeridos, fornecedores, parâmetros 3D |
| **Fornecedores** | Cadastro único, com os itens que cada um fornece |
| **Estrutura** | Árvore de componentes (BOM), com trava contra ciclo |
| **Estoque** | Entradas, saídas, reservas e ajustes; saldo físico / reservado / disponível |
| **Compras** | Cotação → comparativo de preços → pedido → recebimento |
| **Configurações** | Níveis, classificações e prefixos, unidades, usuários |

## Como funciona a cotação de compra

1. Cria a cotação — do zero, a partir dos **itens abaixo do mínimo**, ou explodindo
   a **estrutura de um equipamento**.
2. Os preços que já estão no cadastro de cada item vêm preenchidos como referência.
3. No comparativo (item × fornecedor), o menor preço fica destacado. Você corrige o
   que o fornecedor respondeu e marca o vencedor de cada item.
4. Ao gerar, sai **um pedido por fornecedor** — três itens vencidos pelo mesmo
   fornecedor viram um pedido só.
5. No recebimento (total ou parcial), entra no estoque e o custo unitário do item é
   atualizado para o preço efetivamente pago.

## Regras de negócio que vieram do sistema antigo

Isto é conhecimento do domínio, não código descartável:

- **Código sugerido** — prefixo da classificação + tipo + medida + material:
  `Parafuso M6x20 inox` → `FIX-PAR-M6X20`. Colisão ganha sufixo `-01`, `-02`.
- **Classificação automática** — palavras-chave na descrição: "PARAFUSO" → Fixação,
  "JETSON" → Eletrônica/Automação. Editável em Configurações.
- **Níveis 0–3 com nomes editáveis**. O Nível 0 é o equipamento montado e nunca
  conta como falta.
- **Parâmetros de impressão 3D** aparecem só quando a origem é impressão 3D.
- **Sete tipos de movimento**, com físico / reservado / disponível.

## O que mudou em relação ao desktop

| Antes | Agora | Por quê |
|---|---|---|
| Fornecedor redigitado dentro de cada item | Cadastro próprio + vínculo | Sem isso não dá pra comparar preços — é o que destrava a cotação |
| Tipo de movimento gravado com acento | Chave ASCII + rótulo na interface | Era o bug crítico nº 1 do sistema antigo: `"Entrada fabricacao"` nunca batia com `"Entrada fabricação"` |
| Observações e ficha técnica num campo só, com marcadores e regex | Duas colunas | — |
| Parâmetros 3D colados no fim das observações | Tabela própria | — |
| — | `estoque_minimo` por item | É o que permite o alerta de reposição |
| Saldo calculado item a item, num laço | Um `GROUP BY` | Era N+1 |
| Responsável digitado à mão | Usuário logado + log de auditoria | Duas pessoas na mesma base |

## Stack

Next.js 16 (App Router) · TypeScript · Postgres no Neon via Drizzle · Tailwind v4 ·
sessão própria com `jose` + `bcryptjs`.

## Perfis de acesso

- **Administrador** — tudo, incluindo Configurações e usuários
- **Editor** — cadastra e movimenta, sem acesso a Configurações
- **Somente leitura** — só consulta

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe local |
| `npm run build` | Build de produção (TypeScript estrito) |
| `npm run lint` | ESLint |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:generate` / `db:migrate` | Migrations versionadas (para produção) |
| `npm run db:studio` | Interface visual do banco |
| `npm run db:seed` | Configurações padrão + admin |
| `npm run db:demo` | Dados de demonstração |
