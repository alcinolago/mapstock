import { desc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";

import { AbasCompras } from "@/components/compras/abas-compras";
import { SeloCotacao } from "@/components/situacao";
import { Botao } from "@/components/ui/botao";
import { FiltroMes } from "@/components/ui/filtro-mes";
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
import { abertosForaDoMes, primeiraCotacao, recorteDoMes } from "@/db/consultas";
import { cotacaoItens, cotacoes, usuarios } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { mesesAte, mesValido, rotuloMes } from "@/lib/periodo";
import { data } from "@/lib/utils";

export const metadata = { title: "Cotações" };

export default async function PaginaCotacoes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const mes = mesValido((await searchParams).mes);

  const [lista, maisAntiga, escondidas] = await Promise.all([
    db
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
    .where(recorteDoMes(cotacoes.criadoEm, mes))
    .groupBy(cotacoes.id, usuarios.nome)
    .orderBy(desc(cotacoes.criadoEm)),
    primeiraCotacao(),
    abertosForaDoMes("cotacoes", mes),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Compras"
        descricao="Cote o mesmo item com vários fornecedores, escolha o melhor e gere o pedido."
        acao={
          <>
            <FiltroMes meses={mesesAte(maisAntiga)} />
            {podeEditar && (
              <Link href="/compras/cotacoes/nova">
                <Botao>
                  <Plus className="size-4" />
                  Nova cotação
                </Botao>
              </Link>
            )}
          </>
        }
      />

      <AbasCompras />

      {escondidas > 0 && (
        <p className="mb-4 rounded-xl border-l-4 border-alerta bg-alerta-suave px-4 py-3 text-sm text-texto-suave">
          <strong className="font-semibold text-alerta">
            {escondidas} {escondidas === 1 ? "cotação em aberto" : "cotações em aberto"} fora de{" "}
            {rotuloMes(mes!)}.
          </strong>{" "}
          O recorte é só da tela — nada foi fechado. Volte para “Todo o período” para ver.
        </p>
      )}

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
                  {mes
                    ? `Nenhuma cotação criada em ${rotuloMes(mes)}.`
                    : "Nenhuma cotação ainda. Crie uma a partir dos itens em falta e compare os preços dos fornecedores."}
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
