import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";

import { AbasCompras } from "@/components/compras/abas-compras";
import { FiltrosCotacoes } from "@/components/compras/filtros-cotacoes";
import { MiniaturasItens } from "@/components/itens/miniaturas-itens";
import { SeloCotacao } from "@/components/situacao";
import { Botao } from "@/components/ui/botao";
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
  itensEmCotacoes,
  miniaturasDeCotacoes,
  primeiraCotacao,
  recorteDoMes,
} from "@/db/consultas";
import { cotacaoItens, cotacoes, statusCotacao, usuarios } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import type { StatusCotacao } from "@/lib/labels";
import { lerPaginacao, paginaValida } from "@/lib/paginacao";
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

  const p = await searchParams;
  const mes = mesValido(p.mes);
  const busca = p.busca?.trim() || undefined;
  const item = p.item?.trim() || undefined;
  const status = (statusCotacao.enumValues as readonly string[]).includes(p.status ?? "")
    ? (p.status as StatusCotacao)
    : undefined;

  /* Todo filtro corre na consulta, nunca no cliente: a lista chega paginada,
     e peneirar depois so olharia a pagina que ja veio. */
  const condicoes = [
    recorteDoMes(cotacoes.criadoEm, mes),
    busca ? or(ilike(cotacoes.numero, `%${busca}%`), ilike(cotacoes.titulo, `%${busca}%`)) : undefined,
    status ? eq(cotacoes.status, status) : undefined,
    /* "Em que cotacoes este codigo entrou?" — subconsulta e nao join para a
       cotacao nao se repetir quando o item aparece mais de uma vez. */
    item
      ? inArray(
          cotacoes.id,
          db
            .select({ id: cotacaoItens.cotacaoId })
            .from(cotacaoItens)
            .where(eq(cotacaoItens.itemId, item)),
        )
      : undefined,
  ].filter(Boolean) as SQL[];

  const onde = condicoes.length ? and(...condicoes) : undefined;

  /* A contagem vem antes para prender a pagina ao que existe: filtrar
     encolhe a lista com a pessoa parada numa pagina alta. */
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cotacoes)
    .where(onde);

  const pedida = lerPaginacao(p.pagina, p.porPagina);
  const pagina = paginaValida(pedida.pagina, total, pedida.porPagina);

  const [lista, maisAntiga, escondidas, itensDoFiltro] = await Promise.all([
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
      .where(onde)
      .groupBy(cotacoes.id, usuarios.nome)
      .orderBy(desc(cotacoes.criadoEm))
      .limit(pedida.porPagina)
      .offset((pagina - 1) * pedida.porPagina),
    primeiraCotacao(),
    abertosForaDoMes("cotacoes", mes),
    itensEmCotacoes(),
  ]);

  /* Depois da lista: so as fotos dos itens das cotacoes desta pagina. */
  const fotos = await miniaturasDeCotacoes(lista.map((c) => c.id));

  const temFiltro = Boolean(mes || busca || item || status);

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

      <FiltrosCotacoes itens={itensDoFiltro} meses={mesesAte(maisAntiga)} />

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
                <Coluna>Itens</Coluna>
                <Coluna className="text-right">Qtd.</Coluna>
                <Coluna>Status</Coluna>
                <Coluna>Criada em</Coluna>
                <Coluna>Por</Coluna>
              </tr>
            </Cabecalho>
            <Corpo>
              {lista.length === 0 ? (
                <Vazio colSpan={7}>
                  {temFiltro
                    ? "Nenhuma cotação com esses filtros."
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
                    <Celula>
                      <MiniaturasItens itens={fotos.get(c.id) ?? []} />
                    </Celula>
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

        <Paginacao
          pagina={pagina}
          porPagina={pedida.porPagina}
          total={total}
          oQue="cotações"
        />
      </Cartao>
    </div>
  );
}
