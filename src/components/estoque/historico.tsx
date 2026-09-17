"use client";

import { Undo2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { SeloMovimento } from "@/components/situacao";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Entrada, Selecao } from "@/components/ui/campo";
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
import { MOVIMENTOS, opcoes, type TipoMovimento } from "@/lib/labels";
import { rotuloMes } from "@/lib/periodo";
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
}: {
  movimentos: LinhaMovimento[];
  podeEditar: boolean;
  /** Do mais novo para o mais velho, so os que existem na base. */
  meses: string[];
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [recortando, iniciar] = useTransition();
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");

  /* Tipo e busca peneiram o que ja veio; o mes muda a consulta, porque o
     historico chega limitado e um mes antigo nao caberia no corte. */
  const mes = params.get("mes") ?? "";

  function escolherMes(valor: string) {
    const novos = new URLSearchParams(params);
    if (valor) novos.set("mes", valor);
    else novos.delete("mes");
    iniciar(() => router.replace(`${caminho}?${novos}`, { scroll: false }));
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toUpperCase();
    return movimentos.filter(
      (m) =>
        (!tipo || m.tipo === tipo) &&
        (!t ||
          m.codigo.toUpperCase().includes(t) ||
          m.descricao.toUpperCase().includes(t) ||
          (m.referencia ?? "").toUpperCase().includes(t)),
    );
  }, [movimentos, tipo, busca]);

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
          recortando
            ? "Filtrando..."
            : `${filtrados.length} de ${movimentos.length}${mes ? ` em ${rotuloMes(mes)}` : ""}`
        }
        acao={
          <div className="flex flex-wrap gap-2">
            <Selecao
              value={mes}
              onChange={(e) => escolherMes(e.target.value)}
              className="h-9 w-auto min-w-40 text-xs"
              aria-label="Filtrar por mês"
            >
              <option value="">Todo o período</option>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {rotuloMes(m)}
                </option>
              ))}
            </Selecao>
            <Entrada
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar item ou referência"
              className="h-9 w-52 text-xs"
              aria-label="Buscar movimentações"
            />
            <Selecao
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-9 w-auto min-w-40 text-xs"
              aria-label="Filtrar por tipo"
            >
              <option value="">Todos os tipos</option>
              {opcoes(MOVIMENTOS).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
          </div>
        }
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
            {filtrados.length === 0 ? (
              <Vazio colSpan={podeEditar ? 7 : 6}>
                {movimentos.length > 0
                  ? "Nada encontrado com esses filtros."
                  : mes
                    ? `Nenhuma movimentação em ${rotuloMes(mes)}.`
                    : "Nenhuma movimentação lançada ainda."}
              </Vazio>
            ) : (
              filtrados.map((m) => (
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
