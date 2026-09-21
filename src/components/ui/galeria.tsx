"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/**
 * Uma foto da galeria. Vêm as duas cópias porque a tira de baixo mostra a
 * miniatura (uns 14 KB) e só o quadro grande puxa a foto inteira — abrir uma
 * galeria de três não pode baixar as três em tamanho cheio de uma vez.
 */
export type FotoDaGaleria = {
  grande: string;
  mini: string;
  /** Quando as fotos são de itens diferentes, o que se está olhando. */
  legenda?: string;
};

/**
 * As fotos em tamanho grande, com navegação.
 *
 * Existe porque item passou a ter até três fotos: abrir a primeira e ter de
 * fechar, achar a miniatura da segunda e abrir de novo não é ver o item, é
 * conferir arquivo. Aqui a seta anda entre elas sem sair da janela.
 *
 * Também serve para fotos de itens diferentes — é assim que a lista de
 * cotações e a de pedidos mostram o que o documento pede. Por isso a legenda
 * é por foto, e não um título só da janela.
 *
 * Sai no <Modal> de sempre, que já é portal para o <body> e já fecha no Esc.
 */
export function Galeria({
  fotos,
  inicial = 0,
  aberto,
  aoFechar,
  titulo,
}: {
  fotos: FotoDaGaleria[];
  /** Qual delas a pessoa clicou. */
  inicial?: number;
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
}) {
  const [indice, setIndice] = useState(inicial);
  const [estavaAberto, setEstavaAberto] = useState(aberto);

  /* Reabrir noutra miniatura tem de cair naquela foto: sem isto a janela
     voltaria onde a pessoa parou da última vez.
     O ajuste é na renderização, e não num efeito: o React reinicia a
     renderização na hora, sem pintar a foto errada antes de trocar. */
  if (aberto !== estavaAberto) {
    setEstavaAberto(aberto);
    if (aberto) setIndice(inicial);
  }

  const andar = useCallback(
    (passo: number) => {
      setIndice((atual) => (atual + passo + fotos.length) % fotos.length);
    },
    [fotos.length],
  );

  /* Seta do teclado anda junto com os botões — quem está conferindo peça a
     peça não larga o teclado para clicar. O Esc já é do <Modal>. */
  useEffect(() => {
    if (!aberto || fotos.length < 2) return;

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") andar(-1);
      else if (e.key === "ArrowRight") andar(1);
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, fotos.length, andar]);

  if (fotos.length === 0) return null;

  const atual = fotos[Math.min(indice, fotos.length - 1)];
  const varias = fotos.length > 1;

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      descricao={varias ? `Foto ${indice + 1} de ${fotos.length}` : undefined}
      centralizado
      className="sm:max-w-3xl"
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- bytes servidos
            pela própria aplicação; não passam pelo otimizador de imagem. */}
        <img
          src={atual.grande}
          alt={atual.legenda ?? "Foto ampliada"}
          className="mx-auto max-h-[68vh] w-auto rounded-lg object-contain"
        />

        {varias && (
          <>
            <Seta lado="esquerda" aoClicar={() => andar(-1)} />
            <Seta lado="direita" aoClicar={() => andar(1)} />
          </>
        )}
      </div>

      {atual.legenda && (
        <p className="mt-3 text-center text-xs text-texto-suave">{atual.legenda}</p>
      )}

      {varias && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {fotos.map((foto, i) => (
            <button
              key={foto.grande}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === indice ? "true" : undefined}
              className={cn(
                "size-14 overflow-hidden rounded-lg border-2 transition-colors",
                i === indice ? "border-marca" : "border-borda hover:border-borda-forte",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- idem. */}
              <img
                src={foto.mini}
                alt=""
                className={cn(
                  "size-full object-cover transition-opacity",
                  i === indice ? "opacity-100" : "opacity-70 hover:opacity-100",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Seta({ lado, aoClicar }: { lado: "esquerda" | "direita"; aoClicar: () => void }) {
  const Icone = lado === "esquerda" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={lado === "esquerda" ? "Foto anterior" : "Próxima foto"}
      title={lado === "esquerda" ? "Foto anterior" : "Próxima foto"}
      className={cn(
        "absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-borda bg-superficie/90 text-texto-suave shadow-[var(--sombra-alta)] transition-colors hover:bg-superficie hover:text-texto",
        lado === "esquerda" ? "left-1" : "right-1",
      )}
    >
      <Icone className="size-5" />
    </button>
  );
}
