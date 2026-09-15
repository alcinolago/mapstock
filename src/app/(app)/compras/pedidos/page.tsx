import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";

import { AbasCompras } from "@/components/compras/abas-compras";
import { SeloPedido } from "@/components/situacao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Cartao } from "@/components/ui/cartao";
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
import { fornecedores, pedidoItens, pedidosCompra } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { data, moeda } from "@/lib/utils";

export const metadata = { title: "Pedidos de compra" };

export default async function PaginaPedidos() {
  await exigirSessao();

  const lista = await db
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
    .groupBy(pedidosCompra.id, fornecedores.nome)
    .orderBy(desc(pedidosCompra.criadoEm));

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Compras"
        descricao="Pedidos gerados a partir das cotações. Receber dá entrada no estoque."
      />

      <AbasCompras />

      <Cartao className="overflow-hidden">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Número</Coluna>
                <Coluna>Fornecedor</Coluna>
                <Coluna className="text-right">Linhas</Coluna>
                <Coluna className="text-right">Total</Coluna>
                <Coluna>Status</Coluna>
                <Coluna>Data</Coluna>
              </tr>
            </Cabecalho>
            <Corpo>
              {lista.length === 0 ? (
                <Vazio colSpan={6}>
                  Nenhum pedido ainda. Eles nascem ao fechar uma cotação com fornecedor escolhido.
                </Vazio>
              ) : (
                lista.map((p) => (
                  <Linha key={p.id}>
                    <Celula>
                      <Link
                        href={`/compras/pedidos/${p.id}`}
                        className="codigo text-xs font-semibold text-marca hover:underline"
                      >
                        {p.numero}
                      </Link>
                    </Celula>
                    <Celula className="font-medium">{p.fornecedor}</Celula>
                    <Celula className="num text-right">
                      {p.qtdLinhas}
                      {p.pendentes > 0 && (
                        <span className="ml-1 text-xs text-alerta">({p.pendentes} a receber)</span>
                      )}
                    </Celula>
                    <Celula className="num text-right font-semibold whitespace-nowrap">
                      {moeda(p.total + p.frete)}
                    </Celula>
                    <Celula>
                      <SeloPedido status={p.status} />
                    </Celula>
                    <Celula className="text-xs whitespace-nowrap text-texto-fraco">
                      {data(p.criadoEm)}
                    </Celula>
                  </Linha>
                ))
              )}
            </Corpo>
          </Tabela>
        </RolagemTabela>
      </Cartao>
    </div>
  );
}
