import { asc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcoesCotacao } from "@/components/compras/acoes-cotacao";
import { Comparativo, type ItemCotado } from "@/components/compras/comparativo";
import { SeloCotacao } from "@/components/situacao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { db } from "@/db";
import { fotosPrincipais, listarItensComSaldo } from "@/db/consultas";
import {
  cotacaoItens,
  cotacaoPrecos,
  cotacoes,
  fornecedores,
  itemFornecedores,
  itens,
  unidades,
} from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { data } from "@/lib/utils";

export const metadata = { title: "Cotação" };

export default async function PaginaCotacao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;

  const [cotacao] = await db.select().from(cotacoes).where(eq(cotacoes.id, id));
  if (!cotacao) notFound();

  const [linhas, precos, listaFornecedores, comSaldo] = await Promise.all([
    db
      .select({
        id: cotacaoItens.id,
        itemId: cotacaoItens.itemId,
        quantidade: cotacaoItens.quantidade,
        codigo: itens.codigo,
        descricao: itens.descricao,
        unidade: unidades.sigla,
      })
      .from(cotacaoItens)
      .innerJoin(itens, eq(itens.id, cotacaoItens.itemId))
      .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
      .where(eq(cotacaoItens.cotacaoId, id))
      .orderBy(asc(itens.codigo)),
    db
      .select({
        id: cotacaoPrecos.id,
        cotacaoItemId: cotacaoPrecos.cotacaoItemId,
        fornecedorId: cotacaoPrecos.fornecedorId,
        precoUnitario: cotacaoPrecos.precoUnitario,
        prazoValor: cotacaoPrecos.prazoValor,
        prazoUnidade: cotacaoPrecos.prazoUnidade,
        frete: cotacaoPrecos.frete,
        escolhido: cotacaoPrecos.escolhido,
      })
      .from(cotacaoPrecos)
      .innerJoin(cotacaoItens, eq(cotacaoItens.id, cotacaoPrecos.cotacaoItemId))
      .where(eq(cotacaoItens.cotacaoId, id)),
    db
      .select({ id: fornecedores.id, nome: fornecedores.nome })
      .from(fornecedores)
      .where(eq(fornecedores.ativo, true))
      .orderBy(asc(fornecedores.nome)),
    listarItensComSaldo(),
  ]);

  /* Os fornecedores de cada item, do cadastro. Sao eles que viram coluna
     embaixo do item — a lista global fazia o fornecedor de um item so abrir
     coluna vazia em todos os outros. */
  const vinculos =
    linhas.length === 0
      ? []
      : await db
          .select({
            itemId: itemFornecedores.itemId,
            id: fornecedores.id,
            nome: fornecedores.nome,
          })
          .from(itemFornecedores)
          .innerJoin(fornecedores, eq(fornecedores.id, itemFornecedores.fornecedorId))
          .where(inArray(itemFornecedores.itemId, [...new Set(linhas.map((l) => l.itemId))]))
          .orderBy(asc(itemFornecedores.ordem), asc(fornecedores.nome));

  const itensCotados: ItemCotado[] = linhas.map((l) => ({
    ...l,
    precos: precos.filter((p) => p.cotacaoItemId === l.id),
    fornecedoresDoItem: vinculos
      .filter((v) => v.itemId === l.itemId)
      .map((v) => ({ id: v.id, nome: v.nome })),
  }));

  const editavel =
    sessao.papel !== "leitura" &&
    cotacao.status !== "fechada" &&
    cotacao.status !== "cancelada";

  const fotos = await fotosPrincipais(comSaldo.map((i) => i.id));

  return (
    <div className="mx-auto max-w-[100rem]">
      <Link
        href="/compras/cotacoes"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para cotações
      </Link>

      <CabecalhoPagina
        titulo={cotacao.titulo}
        descricao={`${cotacao.numero} · criada em ${data(cotacao.criadoEm)}`}
        acao={
          <div className="flex flex-wrap items-center gap-3">
            <SeloCotacao status={cotacao.status} />
            {sessao.papel !== "leitura" && (
              <AcoesCotacao
                cotacaoId={cotacao.id}
                status={cotacao.status}
                temEscolhido={precos.some((p) => p.escolhido)}
              />
            )}
          </div>
        }
      />

      {cotacao.observacoes && (
        <p className="mb-4 rounded-lg bg-superficie-2 px-4 py-3 text-sm text-texto-suave">
          {cotacao.observacoes}
        </p>
      )}

      <Comparativo
        cotacaoId={cotacao.id}
        itensCotados={itensCotados}
        fornecedores={listaFornecedores}
        itensDisponiveis={comSaldo.map((i) => ({
          id: i.id,
          codigo: i.codigo,
          descricao: i.descricao,
          unidade: i.unidade,
          disponivel: i.disponivel,
          fotoId: fotos.get(i.id),
        }))}
        editavel={editavel}
      />
    </div>
  );
}
