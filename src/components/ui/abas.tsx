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
      <div role="tablist" className="flex gap-1 border-b border-borda">
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
              "-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition-colors",
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
