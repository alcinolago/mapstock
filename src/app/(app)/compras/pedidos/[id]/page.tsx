import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Recebimento } from "@/components/compras/recebimento";
import { SeloPedido } from "@/components/situacao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { db } from "@/db";
import {
  cotacoes,
  fornecedores,
  itens,
  pedidoItens,
  pedidosCompra,
  unidades,
} from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { data } from "@/lib/utils";

export const metadata = { title: "Pedido de compra" };

export default async function PaginaPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;

  const [pedido] = await db
    .select({
      id: pedidosCompra.id,
      numero: pedidosCompra.numero,
      status: pedidosCompra.status,
      frete: pedidosCompra.frete,
      condicaoPagamento: pedidosCompra.condicaoPagamento,
      observacoes: pedidosCompra.observacoes,
      criadoEm: pedidosCompra.criadoEm,
      fornecedorId: fornecedores.id,
      fornecedor: fornecedores.nome,
      cotacaoId: cotacoes.id,
      cotacaoNumero: cotacoes.numero,
    })
    .from(pedidosCompra)
    .innerJoin(fornecedores, eq(fornecedores.id, pedidosCompra.fornecedorId))
    .leftJoin(cotacoes, eq(cotacoes.id, pedidosCompra.cotacaoId))
    .where(eq(pedidosCompra.id, id));

  if (!pedido) notFound();

  const linhas = await db
    .select({
      id: pedidoItens.id,
      itemId: pedidoItens.itemId,
      codigo: itens.codigo,
      descricao: itens.descricao,
      unidade: unidades.sigla,
      quantidade: pedidoItens.quantidade,
      recebida: pedidoItens.quantidadeRecebida,
      precoUnitario: pedidoItens.precoUnitario,
    })
    .from(pedidoItens)
    .innerJoin(itens, eq(itens.id, pedidoItens.itemId))
    .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
    .where(eq(pedidoItens.pedidoId, id))
    .orderBy(asc(itens.codigo));

  const encerrado = pedido.status === "recebido" || pedido.status === "cancelado";

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/compras/pedidos"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para pedidos
      </Link>

      <CabecalhoPagina
        titulo={pedido.fornecedor}
        descricao={`${pedido.numero} · ${data(pedido.criadoEm)}`}
        acao={<SeloPedido status={pedido.status} />}
      />

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-texto-fraco">
        <Link href={`/fornecedores/${pedido.fornecedorId}`} className="font-semibold text-marca hover:underline">
          Ver fornecedor
        </Link>
        {pedido.cotacaoId && (
          <Link
            href={`/compras/cotacoes/${pedido.cotacaoId}`}
            className="font-semibold text-marca hover:underline"
          >
            Origem: cotação {pedido.cotacaoNumero}
          </Link>
        )}
        {pedido.condicaoPagamento && <span>Pagamento: {pedido.condicaoPagamento}</span>}
      </div>

      <Recebimento
        pedidoId={pedido.id}
        linhas={linhas}
        frete={pedido.frete}
        podeEditar={sessao.papel !== "leitura"}
        encerrado={encerrado}
      />
    </div>
  );
}
