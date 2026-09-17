"use client";

import { Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FiltrosHistorico } from "./filtros-historico";
import { SeloMovimento } from "@/components/situacao";
import { BotaoConfirmar } from "@/components/ui/confirmar";
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
import { estornarMovimento } from "@/lib/acoes/estoque";
import { MOVIMENTOS, type TipoMovimento } from "@/lib/labels";
import { dataHora, numero } from "@/lib/utils";

export type LinhaMovimento = {
  id: string;
  itemId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  tipo: TipoMovimento;
  quantidade: number;
  referencia: string | null;
  observacao: string | null;
  usuario: string | null;
  criadoEm: Date;
};

export function Historico({
  movimentos,
  podeEditar,
  meses,
  itensDoFiltro,
  temFiltro,
  limite,
}: {
  movimentos: LinhaMovimento[];
  podeEditar: boolean;
  /** Do mais novo para o mais velho, so os que existem na base. */
  meses: string[];
  itensDoFiltro: { id: string; codigo: string; descricao: string }[];
  /** Alguma coisa foi filtrada — muda so o texto da tabela vazia. */
  temFiltro: boolean;
  /** Teto da consulta: atingi-lo significa que ha mais fora da tela. */
  limite: number;
}) {
  const router = useRouter();
  const truncado = movimentos.length >= limite;

  async function estornar(id: string) {
    const r = await estornarMovimento(id);
    if (r.erro) return r;
    router.refresh();
  }

  return (
    <Cartao className="overflow-hidden">
      <CabecalhoCartao
        titulo="Histórico de movimentações"
        descricao={
          truncado
            ? `As ${limite} movimentações mais recentes do filtro — estreite o período para ver o resto.`
            : `${movimentos.length} ${movimentos.length === 1 ? "movimentação" : "movimentações"}`
        }
        acao={<FiltrosHistorico itens={itensDoFiltro} meses={meses} />}
      />

      <RolagemTabela>
        <Tabela>
          <Cabecalho>
            <tr>
              <Coluna>Quando</Coluna>
              <Coluna>Tipo</Coluna>
              <Coluna>Item</Coluna>
              <Coluna className="text-right">Qtd.</Coluna>
              <Coluna>Referência</Coluna>
              <Coluna>Quem</Coluna>
              {podeEditar && <Coluna />}
            </tr>
          </Cabecalho>
          <Corpo>
            {movimentos.length === 0 ? (
              <Vazio colSpan={podeEditar ? 7 : 6}>
                {temFiltro
                  ? "Nada encontrado com esses filtros."
                  : "Nenhuma movimentação lançada ainda."}
              </Vazio>
            ) : (
              movimentos.map((m) => (
                <Linha key={m.id}>
                  <Celula className="text-xs whitespace-nowrap text-texto-fraco">
                    {dataHora(m.criadoEm)}
                  </Celula>
                  <Celula>
                    <SeloMovimento tipo={m.tipo} />
                  </Celula>
                  <Celula>
                    <Link href={`/itens/${m.itemId}`} className="group block min-w-0">
                      <span className="codigo block text-xs font-semibold text-marca group-hover:underline">
                        {m.codigo}
                      </span>
                      <span className="block max-w-56 truncate text-xs text-texto-fraco">
                        {m.descricao}
                      </span>
                    </Link>
                  </Celula>
                  <Celula className="num text-right font-semibold whitespace-nowrap">
                    {numero(m.quantidade)} <span className="text-texto-fraco">{m.unidade}</span>
                  </Celula>
                  <Celula className="text-xs text-texto-suave">
                    {m.referencia ?? "—"}
                    {m.observacao && (
                      <span className="block text-texto-fraco">{m.observacao}</span>
                    )}
                  </Celula>
                  <Celula className="text-xs text-texto-fraco">{m.usuario ?? "—"}</Celula>
                  {podeEditar && (
                    <Celula className="text-right">
                      <BotaoConfirmar
                        rotulo={`Estornar movimentação de ${m.codigo}`}
                        Icone={Undo2}
                        tamanho="sm"
                        somenteIcone
                        tom="alerta"
                        iconeClassName="size-3.5"
                        dica="Estornar (lança o movimento oposto)"
                        titulo="Estornar movimentação"
                        descricao={`${m.codigo} · ${MOVIMENTOS[m.tipo]} de ${numero(m.quantidade)} ${m.unidade}`}
                        rotuloConfirmar="Estornar"
                        aoConfirmar={() => estornar(m.id)}
                      >
                        <p>
                          Movimento não se apaga: entra um movimento oposto, de mesma
                          quantidade, e o saldo volta ao que era.
                        </p>
                        <p className="text-texto-fraco">
                          O lançamento original continua no histórico — é assim que dá para
                          reconstruir o que aconteceu depois.
                        </p>
                      </BotaoConfirmar>
                    </Celula>
                  )}
                </Linha>
              ))
            )}
          </Corpo>
        </Tabela>
      </RolagemTabela>
    </Cartao>
  );
}
