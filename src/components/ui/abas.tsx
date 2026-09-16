"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Abas({
  abas,
}: {
  abas: { id: string; rotulo: string; conteudo: ReactNode }[];
}) {
  const base = useId();
  const [ativa, setAtiva] = useState(abas[0]?.id);

  return (
    <div>
      {/* Rola na horizontal em vez de espremer: no celular cabem umas duas
          abas por vez, e aba espremida nao da para ler nem para acertar. */}
      <div
        role="tablist"
        className="rolagem-fina flex gap-1 overflow-x-auto border-b border-borda"
      >
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`${base}-${a.id}`}
            aria-selected={ativa === a.id}
            aria-controls={`${base}-painel-${a.id}`}
            onClick={() => setAtiva(a.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
              ativa === a.id
                ? "border-marca text-marca"
                : "border-transparent text-texto-fraco hover:text-texto",
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {abas.map((a) => (
        <div
          key={a.id}
          role="tabpanel"
          id={`${base}-painel-${a.id}`}
          aria-labelledby={`${base}-${a.id}`}
          hidden={ativa !== a.id}
          className="pt-3"
        >
          {a.conteudo}
        </div>
      ))}
    </div>
  );
}
