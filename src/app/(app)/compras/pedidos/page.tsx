import { and, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import Link from "next/link";

import { AbasCompras } from "@/components/compras/abas-compras";
import { FiltrosPedidos } from "@/components/compras/filtros-pedidos";
import { MiniaturasItens } from "@/components/itens/miniaturas-itens";
import { SeloPedido } from "@/components/situacao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Cartao } from "@/components/ui/cartao";
import { Paginacao } from "@/components/ui/paginacao";
import {
  Cabecalho,
  Celula,
  Coluna,
  Corpo,
  Linha,
  RolagemTabela,
  Tabela,
  Vazio,
} from "@/components/ui/tabela";
import { db } from "@/db";
import {
  abertosForaDoMes,
  fornecedoresComPedido,
  itensEmPedidos,
  miniaturasDePedidos,
  primeiroPedido,
  recorteDoMes,
} from "@/db/consultas";
import { fornecedores, pedidoItens, pedidosCompra, statusPedido } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import type { StatusPedido } from "@/lib/labels";
import { lerPaginacao, paginaValida } from "@/lib/paginacao";
import { mesesAte, mesValido, rotuloMes } from "@/lib/periodo";
import { data, moeda } from "@/lib/utils";

export const metadata = { title: "Pedidos de compra" };

export default async function PaginaPedidos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirSessao();

  const p = await searchParams;
  const mes = mesValido(p.mes);
  const busca = p.busca?.trim() || undefined;
  const item = p.item?.trim() || undefined;
  const fornecedor = p.fornecedor?.trim() || undefined;
  const status = (statusPedido.enumValues as readonly string[]).includes(p.status ?? "")
    ? (p.status as StatusPedido)
    : undefined;

  /* Todo filtro corre na consulta, nunca no cliente: a lista chega paginada,
     e peneirar depois so olharia a pagina que ja veio. */
  const condicoes = [
    recorteDoMes(pedidosCompra.criadoEm, mes),
    busca ? ilike(pedidosCompra.numero, `%${busca}%`) : undefined,
    status ? eq(pedidosCompra.status, status) : undefined,
    fornecedor ? eq(pedidosCompra.fornecedorId, fornecedor) : undefined,
    /* Subconsulta e nao join: com join, o pedido apareceria uma vez por
       linha que casasse com o item. */
    item
      ? inArray(
          pedidosCompra.id,
          db
            .select({ id: pedidoItens.pedidoId })
            .from(pedidoItens)
            .where(eq(pedidoItens.itemId, item)),
        )
      : undefined,
  ].filter(Boolean) as SQL[];

  const onde = condicoes.length ? and(...condicoes) : undefined;

  /* A contagem vem antes para prender a pagina ao que existe: filtrar
     encolhe a lista com a pessoa parada numa pagina alta. */
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(pedidosCompra)
    .where(onde);

  const pedida = lerPaginacao(p.pagina, p.porPagina);
  const pagina = paginaValida(pedida.pagina, total, pedida.porPagina);

  const [lista, maisAntigo, escondidos, itensDoFiltro, fornecedoresDoFiltro] =
    await Promise.all([
      db
        .select({
          id: pedidosCompra.id,
          numero: pedidosCompra.numero,
          status: pedidosCompra.status,
          criadoEm: pedidosCompra.criadoEm,
          frete: pedidosCompra.frete,
          fornecedor: fornecedores.nome,
          qtdLinhas: sql<number>`count(${pedidoItens.id})::int`,
          total: sql<number>`coalesce(sum(${pedidoItens.quantidade} * ${pedidoItens.precoUnitario}), 0)::float8`,
          pendentes: sql<number>`count(*) filter (where ${pedidoItens.quantidadeRecebida} < ${pedidoItens.quantidade})::int`,
        })
        .from(pedidosCompra)
        .innerJoin(fornecedores, eq(fornecedores.id, pedidosCompra.fornecedorId))
        .leftJoin(pedidoItens, eq(pedidoItens.pedidoId, pedidosCompra.id))
        .where(onde)
        .groupBy(pedidosCompra.id, fornecedores.nome)
        .orderBy(desc(pedidosCompra.criadoEm))
        .limit(pedida.porPagina)
        .offset((pagina - 1) * pedida.porPagina),
      primeiroPedido(),
      abertosForaDoMes("pedidos", mes),
      itensEmPedidos(),
      fornecedoresComPedido(),
    ]);

  /* Depois da lista: so as fotos dos itens dos pedidos desta pagina. */
  const fotos = await miniaturasDePedidos(lista.map((l) => l.id));

  const temFiltro = Boolean(mes || busca || item || fornecedor || status);

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Compras"
        descricao="Pedidos gerados a partir das cotações. Receber dá entrada no estoque."
      />

      <AbasCompras />

      <FiltrosPedidos
        fornecedores={fornecedoresDoFiltro}
        itens={itensDoFiltro}
        meses={mesesAte(maisAntigo)}
      />

      {escondidos > 0 && (
        <p className="mb-4 rounded-xl border-l-4 border-alerta bg-alerta-suave px-4 py-3 text-sm text-texto-suave">
          <strong className="font-semibold text-alerta">
            {escondidos} {escondidos === 1 ? "pedido ainda a receber" : "pedidos ainda a receber"}{" "}
            fora de {rotuloMes(mes!)}.
          </strong>{" "}
          O recorte é só da tela — nada foi encerrado. Volte para “Todo o período” para ver.
        </p>
      )}

      <Cartao className="overflow-hidden">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Número</Coluna>
                <Coluna>Fornecedor</Coluna>
                <Coluna>Itens</Coluna>
                <Coluna className="text-right">Linhas</Coluna>
                <Coluna className="text-right">Total</Coluna>
                <Coluna>Status</Coluna>
                <Coluna>Data</Coluna>
              </tr>
            </Cabecalho>
            <Corpo>
              {lista.length === 0 ? (
                <Vazio colSpan={7}>
                  {temFiltro
                    ? "Nenhum pedido com esses filtros."
                    : "Nenhum pedido ainda. Eles nascem ao fechar uma cotação com fornecedor escolhido."}
                </Vazio>
              ) : (
                lista.map((l) => (
                  <Linha key={l.id}>
                    <Celula>
                      <Link
                        href={`/compras/pedidos/${l.id}`}
                        className="codigo text-xs font-semibold text-marca hover:underline"
                      >
                        {l.numero}
                      </Link>
                    </Celula>
                    <Celula className="font-medium">{l.fornecedor}</Celula>
                    <Celula>
                      <MiniaturasItens itens={fotos.get(l.id) ?? []} />
                    </Celula>
                    <Celula className="num text-right">
                      {l.qtdLinhas}
                      {l.pendentes > 0 && (
                        <span className="ml-1 text-xs text-alerta">({l.pendentes} a receber)</span>
                      )}
                    </Celula>
                    <Celula className="num text-right font-semibold whitespace-nowrap">
                      {moeda(l.total + l.frete)}
                    </Celula>
                    <Celula>
                      <SeloPedido status={l.status} />
                    </Celula>
                    <Celula className="text-xs whitespace-nowrap text-texto-fraco">
                      {data(l.criadoEm)}
                    </Celula>
                  </Linha>
                ))
              )}
            </Corpo>
          </Tabela>
        </RolagemTabela>

        <Paginacao
          pagina={pagina}
          porPagina={pedida.porPagina}
          total={total}
          oQue="pedidos"
        />
      </Cartao>
    </div>
  );
}
