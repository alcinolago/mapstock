"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Janela sobre a tela, para a decisão que precisa de contexto antes do
 * clique — a montagem, que mostra o que vai sair do estoque, e a exclusão,
 * que mostra o que vai junto.
 *
 * Sem <dialog> nativo de propósito: ele não anima, não aceita rolagem longa
 * no celular sem brigar com o teclado, e o pouco que ele dá de graça (Esc e
 * foco) cabe nas linhas abaixo.
 *
 * Vai para o <body> num portal, e isso não é preferência: `position: fixed`
 * deixa de valer pela janela quando algum ancestral tem transform, filter ou
 * backdrop-filter — vira bloco de contenção. A barra fixa de salvar do
 * cadastro de item usa backdrop-blur, e a janela aberta dali nasceu presa
 * dentro dela, ancorada no rodapé e com o véu escurecendo só aquela faixa.
 */
export function Modal({
  titulo,
  descricao,
  icone,
  aberto,
  aoFechar,
  children,
  rodape,
  className,
  centralizado = false,
}: {
  titulo: string;
  descricao?: string;
  /** Selo à esquerda do título — dá o tom da decisão antes de ler a frase. */
  icone?: ReactNode;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  className?: string;
  /**
   * Centraliza também no celular, em vez de nascer colada embaixo. Vale para
   * janela curta, de confirmação: a de montagem é longa e continua sendo
   * folha de baixo, onde o polegar alcança a rolagem.
   */
  centralizado?: boolean;
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

  /* No servidor não há document para receber o portal. Nenhuma janela nasce
     aberta, então isto nunca some com conteúdo que já estava na tela. */
  if (!aberto || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center",
        centralizado ? "items-center p-4" : "items-end p-0 sm:items-center sm:p-4",
      )}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={aoFechar}
        className="anima-veu absolute inset-0 bg-veu backdrop-blur-[2px]"
      />

      {/* Sem `centralizado`, no celular a janela nasce colada embaixo. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          "anima-janela relative flex max-h-[90dvh] w-full flex-col overflow-hidden border border-borda bg-superficie shadow-[var(--sombra-alta)] sm:max-w-2xl sm:rounded-2xl",
          centralizado ? "rounded-2xl" : "rounded-t-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-borda bg-superficie-2 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icone}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
              {descricao && (
                <p className="mt-0.5 truncate text-xs text-texto-fraco">{descricao}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1 text-texto-fraco transition-colors hover:bg-superficie hover:text-texto"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="rolagem-fina flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {rodape && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borda bg-superficie-2 px-5 py-3">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
