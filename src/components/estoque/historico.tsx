"use client";

import { Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { SeloMovimento } from "@/components/situacao";
import { Botao } from "@/components/ui/botao";
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
}: {
  movimentos: LinhaMovimento[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");

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

  function estornar(id: string, codigo: string) {
    if (!confirm(`Estornar esta movimentação de ${codigo}?\n\nUm movimento oposto será lançado — o histórico original é preservado.`)) {
      return;
    }
    iniciar(async () => {
      const r = await estornarMovimento(id);
      if (r.erro) alert(r.erro);
      else router.refresh();
    });
  }

  return (
    <Cartao className="overflow-hidden">
      <CabecalhoCartao
        titulo="Histórico de movimentações"
        descricao={`${filtrados.length} de ${movimentos.length}`}
        acao={
          <div className="flex flex-wrap gap-2">
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
                {movimentos.length === 0
                  ? "Nenhuma movimentação lançada ainda."
                  : "Nada encontrado com esses filtros."}
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
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        onClick={() => estornar(m.id, m.codigo)}
                        disabled={pendente}
                        title="Estornar (lança o movimento oposto)"
                      >
                        <Undo2 className="size-3.5" />
                      </Botao>
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
