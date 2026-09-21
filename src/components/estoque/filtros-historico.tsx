"use client";

import { Search } from "lucide-react";

import { Entrada, Selecao } from "@/components/ui/campo";
import {
  AvisoFiltrando,
  BotaoLimpar,
  useBuscaComEspera,
  useFiltrosUrl,
} from "@/components/ui/filtros";
import { hoje, intervaloDoMes, mesDoIntervalo, rotuloMes } from "@/lib/periodo";

/**
 * Os filtros do historico, todos pela URL — porque todos correm na consulta.
 *
 * Nenhum deles peneira no navegador de proposito: o historico chega limitado,
 * e filtrar depois so olharia as ultimas linhas. Escolher um produto antigo
 * devolveria vazio mesmo tendo movimento.
 *
 * O mes e atalho, nao um segundo filtro: escolher um preenche as duas datas.
 * Assim existe um valor de verdade so (de/ate) e nao ha o que arbitrar quando
 * alguem mexe nos dois — o seletor volta a se reconhecer quando as datas
 * cobrem exatamente um mes, e fora disso mostra "personalizado".
 */
export function FiltrosHistorico({
  itens,
  meses,
}: {
  itens: { id: string; codigo: string; descricao: string }[];
  meses: string[];
}) {
  const { params, aplicar, limpar, pendente } = useFiltrosUrl();

  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";
  const mes = mesDoIntervalo(de || undefined, ate || undefined) ?? "";
  const personalizado = Boolean(de || ate) && !mes;

  const [busca, setBusca] = useBuscaComEspera(params, aplicar);

  const temFiltro = Boolean(de || ate || params.get("item") || params.get("busca"));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Selecao
        value={params.get("item") ?? ""}
        onChange={(e) => aplicar({ item: e.target.value })}
        className="h-9 w-auto min-w-52 max-w-72 text-xs"
        aria-label="Filtrar por produto"
      >
        <option value="">Todos os produtos</option>
        {itens.map((i) => (
          <option key={i.id} value={i.id}>
            {i.codigo} — {i.descricao}
          </option>
        ))}
      </Selecao>

      <Selecao
        value={mes}
        onChange={(e) =>
          aplicar(e.target.value ? intervaloDoMes(e.target.value) : { de: "", ate: "" })
        }
        className="h-9 w-auto min-w-36 text-xs"
        aria-label="Atalho de mês"
      >
        <option value="">{personalizado ? "Personalizado" : "Todo o período"}</option>
        {meses.map((m) => (
          <option key={m} value={m}>
            {rotuloMes(m)}
          </option>
        ))}
      </Selecao>

      <span className="inline-flex items-center gap-1.5 text-xs text-texto-fraco">
        de
        <Entrada
          type="date"
          value={de}
          max={ate || hoje()}
          onChange={(e) => aplicar({ de: e.target.value })}
          className="h-9 w-auto text-xs"
          aria-label="Data inicial"
        />
        até
        <Entrada
          type="date"
          value={ate}
          min={de || undefined}
          max={hoje()}
          onChange={(e) => aplicar({ ate: e.target.value })}
          className="h-9 w-auto text-xs"
          aria-label="Data final"
        />
      </span>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-texto-fraco" />
        <Entrada
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Referência ou observação"
          className="h-9 w-52 pl-8 text-xs"
          aria-label="Buscar por referência ou observação"
        />
      </div>

      {temFiltro && <BotaoLimpar aoLimpar={limpar} />}
      <AvisoFiltrando pendente={pendente} />
    </div>
  );
}
