"use client";

import { useState } from "react";

import { fotoDaGaleria } from "@/components/itens/miniatura-ampliavel";
import { Galeria } from "@/components/ui/galeria";
import type { MiniaturaDeItem } from "@/db/consultas";

/**
 * A pilha de fotos dos itens de um documento — uma cotação, um pedido.
 *
 * A lista mostra documento, não item: número, título e contagem não dizem o
 * que está sendo comprado, e quem trabalha na prateleira reconhece a peça
 * pela foto antes de ler o código. Três cabem na linha sem espremer as outras
 * colunas; o resto vira "+N", que abre a galeria no mesmo lugar.
 *
 * Só entra item que tem foto, e cada item entra uma vez — a pilha representa
 * o que o documento pede, não o acervo de fotos de cada peça.
 */
export function MiniaturasItens({
  itens,
  limite = 3,
}: {
  itens: MiniaturaDeItem[];
  limite?: number;
}) {
  const [abertaEm, setAbertaEm] = useState<number | null>(null);

  if (itens.length === 0) {
    return <span className="text-xs text-texto-fraco">—</span>;
  }

  const visiveis = itens.slice(0, limite);
  const restantes = itens.length - visiveis.length;

  return (
    <>
      <div className="flex items-center">
        {visiveis.map((item, i) => (
          <button
            key={item.itemId}
            type="button"
            onClick={() => setAbertaEm(i)}
            title={`${item.codigo} — ${item.descricao}`}
            className="-ml-2 cursor-zoom-in rounded transition-transform first:ml-0 hover:z-10 hover:scale-110"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- bytes da
                própria aplicação; não passam pelo otimizador de imagem. */}
            <img
              src={`/api/fotos/${item.fotoId}?mini=1`}
              alt={`Foto de ${item.descricao}`}
              loading="lazy"
              className="size-8 rounded border border-borda bg-superficie-2 object-cover ring-2 ring-superficie"
            />
          </button>
        ))}

        {restantes > 0 && (
          <button
            type="button"
            onClick={() => setAbertaEm(limite)}
            title={`Ver as outras ${restantes}`}
            className="num -ml-2 grid size-8 place-items-center rounded border border-borda bg-superficie-2 text-[10px] font-bold text-texto-suave ring-2 ring-superficie transition-colors hover:text-marca"
          >
            +{restantes}
          </button>
        )}
      </div>

      <Galeria
        fotos={itens.map((item) => fotoDaGaleria(item.fotoId, `${item.codigo} — ${item.descricao}`))}
        inicial={abertaEm ?? 0}
        aberto={abertaEm !== null}
        aoFechar={() => setAbertaEm(null)}
        titulo={`Itens com foto (${itens.length})`}
      />
    </>
  );
}
