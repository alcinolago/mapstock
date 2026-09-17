"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Selecao } from "@/components/ui/campo";
import { rotuloMes } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/**
 * Recorte de mes, sempre pela URL.
 *
 * O recorte anda na consulta, nao no cliente: peneirar depois so olharia o
 * que ja tinha vindo, e listagem com limite devolveria mes antigo vazio.
 *
 * Comeca em "todo o periodo" de proposito. Pedido e cotacao em aberto sao
 * fila de trabalho, e escondido por padrao viraria servico esquecido — quem
 * limita o periodo e quem pede, e a URL nao fica guardada entre visitas.
 */
export function FiltroMes({
  meses,
  className,
}: {
  /** Do mais novo para o mais velho, so os que existem na base. */
  meses: string[];
  className?: string;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  function escolher(valor: string) {
    const novos = new URLSearchParams(params);
    if (valor) novos.set("mes", valor);
    else novos.delete("mes");
    iniciar(() => router.replace(`${caminho}?${novos}`, { scroll: false }));
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Selecao
        value={params.get("mes") ?? ""}
        onChange={(e) => escolher(e.target.value)}
        className={cn("h-9 w-auto min-w-40 text-xs", className)}
        aria-label="Filtrar por mês"
      >
        <option value="">Todo o período</option>
        {meses.map((m) => (
          <option key={m} value={m}>
            {rotuloMes(m)}
          </option>
        ))}
      </Selecao>
      {pendente && <span className="text-xs text-texto-fraco">Filtrando...</span>}
    </span>
  );
}
