import { ArrowLeft, FileDown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ItensPedido } from "@/components/compras/itens-pedido";
import { SeloPedido } from "@/components/situacao";
import { botao } from "@/components/ui/botao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { fotosDosItens, pedidoCompleto } from "@/db/consultas";
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

  const dados = await pedidoCompleto(id);
  if (!dados) notFound();

  const { pedido, linhas } = dados;

  /* So os ids: `pedidoCompleto` ja traz os bytes da miniatura, mas aqueles
     sao do PDF e nao atravessam para o navegador. */
  const fotos = await fotosDosItens(linhas.map((l) => l.itemId));

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
            {/* Link comum de proposito: funciona sem JavaScript, o navegador
                cuida do arquivo e ninguem fica esperando na tela. */}
            <a
              href={`/api/exportar/pedido/${pedido.id}`}
              className={botao({ variante: "contorno", tamanho: "md" })}
            >
              <FileDown className="size-4" />
              Baixar PDF
            </a>
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
        fotos={Object.fromEntries(fotos)}
        frete={pedido.frete}
        podeEditar={sessao.papel !== "leitura"}
        status={pedido.status}
      />
    </div>
  );
}
