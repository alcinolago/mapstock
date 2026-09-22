"use client";

import { Selecao } from "@/components/ui/campo";
import { Entrada } from "@/components/ui/campo";
import { AvisoFiltrando, BotaoLimpar, useFiltrosUrl } from "@/components/ui/filtros";
import { hoje, intervaloDoMes, mesDoIntervalo, rotuloMes } from "@/lib/periodo";

/**
 * O recorte do histórico. Mesma ideia do histórico de movimentações: o mês é
 * atalho, não um segundo filtro — escolher um preenche as duas datas, então
 * existe um valor de verdade só e não há o que arbitrar quando alguém mexe
 * nos dois.
 */
export function FiltrosHistoricoMontagem({ meses }: { meses: string[] }) {
  const { params, aplicar, limpar, pendente } = useFiltrosUrl();

  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";
  const mes = mesDoIntervalo(de || undefined, ate || undefined) ?? "";
  const personalizado = Boolean(de || ate) && !mes;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
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

      {(de || ate) && <BotaoLimpar aoLimpar={limpar} />}
      <AvisoFiltrando pendente={pendente} />
    </div>
  );
}
