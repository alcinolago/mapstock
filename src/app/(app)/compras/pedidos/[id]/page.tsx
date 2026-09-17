import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcoesPedido } from "@/components/compras/acoes-pedido";
import { ItensPedido } from "@/components/compras/itens-pedido";
import { SeloPedido } from "@/components/situacao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { pedidoCompleto } from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";
import { data, moeda } from "@/lib/utils";

export const metadata = { title: "Pedido de compra" };

export default async function PaginaPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;

  const dados = await pedidoCompleto(id);
  if (!dados) notFound();

  const { pedido, linhas } = dados;
  const total = linhas.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0) + pedido.frete;

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
        acao={
          <>
            <SeloPedido status={pedido.status} />
            <AcoesPedido
              pedidoId={pedido.id}
              numero={pedido.numero}
              fornecedor={pedido.fornecedor}
              totalItens={linhas.length}
              total={moeda(total)}
            />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-texto-fraco">
        <Link
          href={`/fornecedores/${pedido.fornecedorId}`}
          className="font-semibold text-marca hover:underline"
        >
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

      <ItensPedido
        pedidoId={pedido.id}
        linhas={linhas}
        frete={pedido.frete}
        podeEditar={sessao.papel !== "leitura"}
        status={pedido.status}
      />
    </div>
  );
}
