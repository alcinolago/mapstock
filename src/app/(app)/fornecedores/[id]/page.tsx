import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FormularioFornecedor } from "@/components/fornecedores/formulario-fornecedor";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { CabecalhoCartao, Cartao } from "@/components/ui/cartao";
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
import { fornecedores, itemFornecedores, itens } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { moeda, numero } from "@/lib/utils";
import { linkDoItem } from "@/lib/voltar";

export const metadata = { title: "Editar fornecedor" };

export default async function EditarFornecedor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;

  const [[fornecedor], fornecidos] = await Promise.all([
    db.select().from(fornecedores).where(eq(fornecedores.id, id)),
    db
      .select({
        itemId: itens.id,
        codigo: itens.codigo,
        descricao: itens.descricao,
        preco: itemFornecedores.preco,
        prazoValor: itemFornecedores.prazoValor,
        prazoUnidade: itemFornecedores.prazoUnidade,
        sku: itemFornecedores.skuFornecedor,
        principal: itemFornecedores.principal,
      })
      .from(itemFornecedores)
      .innerJoin(itens, eq(itens.id, itemFornecedores.itemId))
      .where(eq(itemFornecedores.fornecedorId, id))
      .orderBy(asc(itens.codigo)),
  ]);

  if (!fornecedor) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/fornecedores"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
        >
          <ArrowLeft className="size-3.5" />
          Voltar para fornecedores
        </Link>
        <CabecalhoPagina titulo={fornecedor.nome} />
      </div>

      <FormularioFornecedor
        fornecedor={fornecedor}
        podeExcluir={sessao.papel !== "leitura"}
      />

      <Cartao className="overflow-hidden">
        <CabecalhoCartao
          titulo="Itens fornecidos"
          descricao="Preços vinculados no cadastro de cada item."
        />
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Código</Coluna>
                <Coluna>Descrição</Coluna>
                <Coluna>SKU</Coluna>
                <Coluna className="text-right">Preço</Coluna>
                <Coluna className="text-right">Prazo</Coluna>
              </tr>
            </Cabecalho>
            <Corpo>
              {fornecidos.length === 0 ? (
                <Vazio colSpan={5}>
                  Nenhum item vinculado. O vínculo é feito no cadastro do item.
                </Vazio>
              ) : (
                fornecidos.map((f) => (
                  <Linha key={f.itemId}>
                    <Celula>
                      <Link
                        href={linkDoItem(f.itemId, `/fornecedores/${id}`)}
                        className="codigo text-xs font-semibold text-marca hover:underline"
                      >
                        {f.codigo}
                      </Link>
                      {f.principal && (
                        <span className="ml-2 text-xs font-semibold text-marca">principal</span>
                      )}
                    </Celula>
                    <Celula className="max-w-64 truncate">{f.descricao}</Celula>
                    <Celula className="text-xs text-texto-fraco">{f.sku ?? "—"}</Celula>
                    <Celula className="num text-right font-semibold">{moeda(f.preco)}</Celula>
                    <Celula className="num text-right text-texto-fraco">
                      {f.prazoValor > 0 ? `${numero(f.prazoValor)} ${f.prazoUnidade}` : "—"}
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
