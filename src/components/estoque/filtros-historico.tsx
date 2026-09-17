"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campo";
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
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";
  const mes = mesDoIntervalo(de || undefined, ate || undefined) ?? "";
  const personalizado = Boolean(de || ate) && !mes;

  const [busca, setBusca] = useState(params.get("busca") ?? "");

  function aplicar(mudancas: Record<string, string>) {
    const novos = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) novos.set(chave, valor);
      else novos.delete(chave);
    }
    iniciar(() => router.replace(`${caminho}?${novos}`, { scroll: false }));
  }

  /* Busca com espera: nao dispara uma consulta por tecla digitada. */
  useEffect(() => {
    if (busca === (params.get("busca") ?? "")) return;
    const t = setTimeout(() => aplicar({ busca }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

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

      {temFiltro && (
        <Botao
          variante="suave"
          tamanho="sm"
          onClick={() => {
            setBusca("");
            iniciar(() => router.replace(caminho, { scroll: false }));
          }}
        >
          <X className="size-3.5" />
          Limpar
        </Botao>
      )}

      {pendente && <span className="text-xs text-texto-fraco">Filtrando...</span>}
    </div>
  );
}
