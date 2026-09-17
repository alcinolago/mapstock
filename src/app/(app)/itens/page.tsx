import { Download, Plus } from "lucide-react";
import Link from "next/link";

import { FiltrosItens } from "@/components/itens/filtros-itens";
import { SeloSituacao } from "@/components/situacao";
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
import { listarItensComSaldo, type SituacaoItem } from "@/db/consultas";
import { classificacoes, niveis } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { dataValida, rotuloData } from "@/lib/periodo";
import { moeda, numero } from "@/lib/utils";

export const metadata = { title: "Itens" };

const SITUACOES: SituacaoItem[] = ["ok", "falta", "abaixo_minimo", "nao_estocavel"];

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

  /* Posicao retroativa: "como estava o estoque em 31/08". So existe porque
     saldo e sempre a soma do historico, nunca um campo gravado. */
  const em = dataValida(p.em);

  const [lista, listaClassificacoes, listaNiveis] = await Promise.all([
    listarItensComSaldo({
      busca: p.busca,
      classificacaoId: p.classificacao,
      nivel: p.nivel ? Number(p.nivel) : undefined,
      situacao,
      incluirInativos: p.inativos === "1",
      em,
    }),
    db.select().from(classificacoes).orderBy(classificacoes.ordem),
    db.select().from(niveis).orderBy(niveis.num),
  ]);

  const nomeNivel = new Map(listaNiveis.map((n) => [n.num, n.nome]));
  const podeEditar = sessao.papel !== "leitura";

  return (
    <div className="mx-auto max-w-[100rem]">
      <CabecalhoPagina
        titulo="Itens"
        descricao={`${lista.length} ${lista.length === 1 ? "item" : "itens"} — peças, componentes e consumíveis`}
        acao={
          <>
            {/* Leva os filtros da tela junto: baixa o que está sendo visto. */}
            <a href={`/api/exportar/itens?${new URLSearchParams(
              Object.entries(p).filter(([, v]) => v) as [string, string][],
            )}`}>
              <Botao variante="contorno">
                <Download className="size-4" />
                Exportar CSV
              </Botao>
            </a>
            {podeEditar && (
              <Link href="/itens/novo">
                <Botao>
                  <Plus className="size-4" />
                  Novo item
                </Botao>
              </Link>
            )}
          </>
        }
      />

      <FiltrosItens classificacoes={listaClassificacoes} niveis={listaNiveis} />

      {em && (
        <p className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border-l-4 border-alerta bg-alerta-suave px-4 py-3 text-sm">
          <span className="font-semibold text-alerta">
            Posição de {rotuloData(em)}, não a de hoje.
          </span>
          <span className="text-texto-suave">
            Físico, reservado e disponível são a soma do histórico até aquele dia. Custo
            unitário, estoque mínimo e situação são os do cadastro de hoje — o sistema não
            guarda o custo que o item tinha na época.
          </span>
        </p>
      )}

      <Cartao className="overflow-hidden">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Código</Coluna>
                <Coluna>Descrição</Coluna>
                <Coluna>Classificação</Coluna>
                <Coluna>Nível</Coluna>
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
                    <Celula className="text-xs whitespace-nowrap text-texto-fraco">
                      {i.nivel} — {nomeNivel.get(i.nivel) ?? "—"}
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
      </Cartao>
    </div>
  );
}
