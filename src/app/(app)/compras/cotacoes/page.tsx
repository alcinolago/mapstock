import { desc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";

import { AbasCompras } from "@/components/compras/abas-compras";
import { SeloCotacao } from "@/components/situacao";
import { Botao } from "@/components/ui/botao";
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
import { cotacaoItens, cotacoes, usuarios } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { data } from "@/lib/utils";

export const metadata = { title: "Cotações" };

export default async function PaginaCotacoes() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const lista = await db
    .select({
      id: cotacoes.id,
      numero: cotacoes.numero,
      titulo: cotacoes.titulo,
      status: cotacoes.status,
      criadoEm: cotacoes.criadoEm,
      autor: usuarios.nome,
      qtdItens: sql<number>`count(${cotacaoItens.id})::int`,
    })
    .from(cotacoes)
    .leftJoin(cotacaoItens, eq(cotacaoItens.cotacaoId, cotacoes.id))
    .leftJoin(usuarios, eq(usuarios.id, cotacoes.criadoPor))
    .groupBy(cotacoes.id, usuarios.nome)
    .orderBy(desc(cotacoes.criadoEm));

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Compras"
        descricao="Cote o mesmo item com vários fornecedores, escolha o melhor e gere o pedido."
        acao={
          podeEditar && (
            <Link href="/compras/cotacoes/nova">
              <Botao>
                <Plus className="size-4" />
                Nova cotação
              </Botao>
            </Link>
          )
        }
      />

      <AbasCompras />

      <Cartao className="overflow-hidden">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Número</Coluna>
                <Coluna>Título</Coluna>
                <Coluna className="text-right">Itens</Coluna>
                <Coluna>Status</Coluna>
                <Coluna>Criada em</Coluna>
                <Coluna>Por</Coluna>
              </tr>
            </Cabecalho>
            <Corpo>
              {lista.length === 0 ? (
                <Vazio colSpan={6}>
                  Nenhuma cotação ainda. Crie uma a partir dos itens em falta e compare os preços
                  dos fornecedores.
                </Vazio>
              ) : (
                lista.map((c) => (
                  <Linha key={c.id}>
                    <Celula>
                      <Link
                        href={`/compras/cotacoes/${c.id}`}
                        className="codigo text-xs font-semibold text-marca hover:underline"
                      >
                        {c.numero}
                      </Link>
                    </Celula>
                    <Celula className="max-w-80 truncate font-medium">{c.titulo}</Celula>
                    <Celula className="num text-right">{c.qtdItens}</Celula>
                    <Celula>
                      <SeloCotacao status={c.status} />
                    </Celula>
                    <Celula className="text-xs whitespace-nowrap text-texto-fraco">
                      {data(c.criadoEm)}
                    </Celula>
                    <Celula className="text-xs text-texto-fraco">{c.autor ?? "—"}</Celula>
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
