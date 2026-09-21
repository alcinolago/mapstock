import { Plus } from "lucide-react";
import Link from "next/link";

import { FiltrosItens } from "@/components/itens/filtros-itens";
import { MiniaturaAmpliavel } from "@/components/itens/miniatura-ampliavel";
import { SeloSituacao } from "@/components/situacao";
import { Botao } from "@/components/ui/botao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Paginacao } from "@/components/ui/paginacao";
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
import {
  codigosDeItens,
  contarItens,
  fotosDosItens,
  listarItensComSaldo,
  listarLocais,
  type FiltrosItens as Filtros,
  type SituacaoItem,
} from "@/db/consultas";
import { classificacoes } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { lerPaginacao, paginaValida } from "@/lib/paginacao";
import { moeda, numero } from "@/lib/utils";

export const metadata = { title: "Itens" };

const SITUACOES: SituacaoItem[] = ["ok", "falta", "abaixo_minimo"];

export default async function PaginaItens({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sessao = await exigirSessao();
  const p = await searchParams;

  const situacao = SITUACOES.includes(p.situacao as SituacaoItem)
    ? (p.situacao as SituacaoItem)
    : undefined;

  const filtros: Filtros = {
    busca: p.busca,
    classificacaoId: p.classificacao,
    situacao,
    incluirInativos: p.inativos === "1",
    itemId: p.item?.trim() || undefined,
    localId: p.local?.trim() || undefined,
  };

  /* A contagem vem antes para prender a pagina ao que existe: filtrar
     encolhe a lista com a pessoa parada numa pagina alta, e a tela viria
     vazia sem explicacao. */
  const total = await contarItens(filtros);
  const pedida = lerPaginacao(p.pagina, p.porPagina);
  const pagina = paginaValida(pedida.pagina, total, pedida.porPagina);
  const pular = (pagina - 1) * pedida.porPagina;

  const [lista, listaClassificacoes, cadastro, listaLocais] = await Promise.all([
    listarItensComSaldo({ ...filtros, porPagina: pedida.porPagina, pular }),
    db.select().from(classificacoes).orderBy(classificacoes.ordem),
    codigosDeItens(),
    listarLocais(),
  ]);

  /* Depois da lista: so as fotos dos itens que esta pagina mostra. Vem
     todas, e nao so a principal — quem clica na miniatura abre a galeria, e
     ela precisa saber para onde navegar sem outra ida ao servidor. */
  const fotos = await fotosDosItens(lista.map((i) => i.id));

  const podeEditar = sessao.papel !== "leitura";

  return (
    <div className="mx-auto max-w-[100rem]">
      <CabecalhoPagina
        titulo="Itens"
        descricao={`${total} ${total === 1 ? "item" : "itens"} em estoque — saldo, custo e situação de cada um`}
        acao={
          podeEditar && (
            <Link href="/itens/novo">
              <Botao>
                <Plus className="size-4" />
                Novo item
              </Botao>
            </Link>
          )
        }
      />

      <FiltrosItens
        classificacoes={listaClassificacoes}
        itens={cadastro}
        locais={listaLocais}
      />

      <Cartao className="overflow-hidden">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna className="w-8" />
                <Coluna>Código</Coluna>
                <Coluna>Descrição</Coluna>
                <Coluna>Classificação</Coluna>
                <Coluna className="text-right">Físico</Coluna>
                <Coluna className="text-right">Reserv.</Coluna>
                <Coluna className="text-right">Dispon.</Coluna>
                <Coluna className="text-right">Custo un.</Coluna>
                <Coluna className="text-right">Total</Coluna>
                <Coluna>Situação</Coluna>
                <Coluna>Local</Coluna>
              </tr>
            </Cabecalho>
            <Corpo>
              {lista.length === 0 ? (
                <Vazio colSpan={11}>
                  Nenhum item encontrado. Ajuste os filtros ou cadastre o primeiro.
                </Vazio>
              ) : (
                lista.map((i) => (
                  <Linha key={i.id}>
                    <Celula className="pr-0">
                      <MiniaturaAmpliavel
                        fotos={fotos.get(i.id) ?? []}
                        descricao={i.descricao}
                        codigo={i.codigo}
                      />
                    </Celula>
                    <Celula>
                      <Link
                        href={`/itens/${i.id}`}
                        className="codigo text-xs font-semibold text-marca hover:underline"
                      >
                        {i.codigo}
                      </Link>
                    </Celula>
                    <Celula className="max-w-72">
                      <span className="block truncate" title={i.descricao}>
                        {i.descricao}
                      </span>
                      {!i.ativo && (
                        <span className="text-xs font-medium text-texto-fraco">inativo</span>
                      )}
                    </Celula>
                    <Celula className="text-xs whitespace-nowrap text-texto-suave">
                      {i.classificacao}
                    </Celula>
                    <Celula className="num text-right whitespace-nowrap">
                      {numero(i.fisico)} <span className="text-texto-fraco">{i.unidade}</span>
                    </Celula>
                    <Celula className="num text-right text-texto-fraco">
                      {i.reservado > 0 ? numero(i.reservado) : "—"}
                    </Celula>
                    <Celula className="num text-right font-semibold">{numero(i.disponivel)}</Celula>
                    <Celula className="num text-right whitespace-nowrap text-texto-suave">
                      {moeda(i.custoUnitario)}
                    </Celula>
                    <Celula className="num text-right font-semibold whitespace-nowrap">
                      {moeda(i.valorEstoque)}
                    </Celula>
                    <Celula>
                      <SeloSituacao situacao={i.situacao} />
                    </Celula>
                    <Celula className="text-xs text-texto-fraco">{i.localizacao ?? "—"}</Celula>
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
          oQue="itens"
        />
      </Cartao>
    </div>
  );
}
