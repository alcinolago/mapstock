import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { FormularioMovimento } from "@/components/estoque/formulario-movimento";
import { Historico } from "@/components/estoque/historico";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { db } from "@/db";
import {
  fotosPrincipais,
  itensComMovimento,
  listarItensComSaldo,
  primeiroMovimento,
  recorteEntre,
} from "@/db/consultas";
import { itens, movimentos, unidades, usuarios } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { lerPaginacao, paginaValida } from "@/lib/paginacao";
import { dataValida, mesesAte } from "@/lib/periodo";

export const metadata = { title: "Movimentações" };

export default async function PaginaEstoque({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const p = await searchParams;

  /* Todos os filtros correm na consulta, nunca no cliente: o historico chega
     limitado, e peneirar depois so olharia as ultimas linhas — escolher um
     produto antigo devolveria vazio mesmo tendo movimento. */
  const de = dataValida(p.de);
  const ate = dataValida(p.ate);
  const item = p.item?.trim() || undefined;
  const busca = p.busca?.trim() || undefined;
  const temFiltro = Boolean(de || ate || item || busca);

  const condicoes = [
    recorteEntre(movimentos.criadoEm, de, ate),
    item ? eq(movimentos.itemId, item) : undefined,
    busca
      ? or(
          ilike(movimentos.referencia, `%${busca}%`),
          ilike(movimentos.observacao, `%${busca}%`),
          ilike(itens.codigo, `%${busca}%`),
          ilike(itens.descricao, `%${busca}%`),
        )
      : undefined,
  ].filter(Boolean);

  const onde = condicoes.length ? and(...condicoes) : undefined;

  /* A contagem vem antes para prender a pagina ao que existe: filtrar
     encolhe a lista com a pessoa parada numa pagina alta. */
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(movimentos)
    .innerJoin(itens, eq(itens.id, movimentos.itemId))
    .where(onde);

  const pedida = lerPaginacao(p.pagina, p.porPagina);
  const pagina = paginaValida(pedida.pagina, total, pedida.porPagina);

  const [comSaldo, historico, maisAntigo, itensDoFiltro] = await Promise.all([
    listarItensComSaldo(),
    db
      .select({
        id: movimentos.id,
        itemId: movimentos.itemId,
        codigo: itens.codigo,
        descricao: itens.descricao,
        unidade: unidades.sigla,
        tipo: movimentos.tipo,
        quantidade: movimentos.quantidade,
        referencia: movimentos.referencia,
        observacao: movimentos.observacao,
        usuario: usuarios.nome,
        criadoEm: movimentos.criadoEm,
      })
      .from(movimentos)
      .innerJoin(itens, eq(itens.id, movimentos.itemId))
      .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
      .leftJoin(usuarios, eq(usuarios.id, movimentos.usuarioId))
      .where(onde)
      .orderBy(desc(movimentos.criadoEm))
      .limit(pedida.porPagina)
      .offset((pagina - 1) * pedida.porPagina),
    primeiroMovimento(),
    itensComMovimento(),
  ]);

  const fotos = await fotosPrincipais(comSaldo.map((i) => i.id));

  const selecionaveis = comSaldo.map((i) => ({
    id: i.id,
    codigo: i.codigo,
    descricao: i.descricao,
    unidade: i.unidade,
    disponivel: i.disponivel,
    fotoId: fotos.get(i.id),
  }));

  return (
    <div className="mx-auto max-w-[100rem]">
      <CabecalhoPagina
        titulo="Movimentações"
        descricao="O histórico do estoque: entradas, saídas, reservas e ajustes. O saldo de cada item é sempre a soma disto."
      />

      <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
        {podeEditar ? (
          <FormularioMovimento itens={selecionaveis} />
        ) : (
          <p className="rounded-xl border border-borda bg-superficie px-4 py-6 text-sm text-texto-fraco">
            Seu perfil é somente leitura: dá para consultar o histórico, mas não lançar
            movimentações.
          </p>
        )}

        <Historico
          movimentos={historico}
          podeEditar={podeEditar}
          meses={mesesAte(maisAntigo)}
          itensDoFiltro={itensDoFiltro}
          temFiltro={temFiltro}
          pagina={pagina}
          porPagina={pedida.porPagina}
          total={total}
        />
      </div>
    </div>
  );
}
