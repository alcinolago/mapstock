"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Janela sobre a tela, para a decisão que precisa de contexto antes do
 * clique — hoje é a montagem, que mostra o que vai sair do estoque antes de
 * confirmar.
 *
 * Sem <dialog> nativo de propósito: ele não anima, não aceita rolagem longa
 * no celular sem brigar com o teclado, e o pouco que ele dá de graça (Esc e
 * foco) cabe nas linhas abaixo.
 */
export function Modal({
  titulo,
  descricao,
  aberto,
  aoFechar,
  children,
  rodape,
  className,
}: {
  titulo: string;
  descricao?: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }

    /* Trava a rolagem de trás: no celular, rolar a modal arrastava a página
       inteira junto e a pessoa perdia o lugar. */
    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = rolagemAnterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={aoFechar}
        className="absolute inset-0 bg-black/50"
      />

      {/* No celular a janela nasce colada embaixo, onde o polegar alcança. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-borda bg-superficie shadow-lg sm:max-w-2xl sm:rounded-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-borda px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-xs text-texto-fraco">{descricao}</p>}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1 text-texto-fraco transition-colors hover:bg-superficie-2 hover:text-texto"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="rolagem-fina flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {rodape && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borda px-5 py-3">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}
