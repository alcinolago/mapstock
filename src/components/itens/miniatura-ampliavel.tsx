"use client";

import { useState } from "react";

import { MiniaturaItem } from "@/components/itens/miniatura-item";
import { Galeria, type FotoDaGaleria } from "@/components/ui/galeria";
import { cn } from "@/lib/utils";

/** Os dois endereços da mesma foto: a miniatura e a de tamanho cheio. */
export function fotoDaGaleria(id: string, legenda?: string): FotoDaGaleria {
  return { grande: `/api/fotos/${id}`, mini: `/api/fotos/${id}?mini=1`, legenda };
}

/**
 * A miniatura do item nas listagens, que abre a galeria ao ser clicada.
 *
 * Só vira botão quando há foto: sem nenhuma, fica o mesmo quadro vazio de
 * antes — clicável sem nada para mostrar seria promessa falsa, e a coluna
 * precisa ocupar o lugar de qualquer jeito para a tabela não desalinhar.
 *
 * O contador no canto existe porque a lista mostra sempre a principal: sem
 * ele, não há como saber que aquele item tem outras duas fotos atrás.
 */
export function MiniaturaAmpliavel({
  fotos,
  descricao,
  codigo,
  className,
}: {
  /** Os ids das fotos do item, na ordem do cadastro. */
  fotos: string[];
  descricao: string;
  /** Vai no título da janela, junto da descrição. */
  codigo?: string;
  className?: string;
}) {
  const [aberta, setAberta] = useState(false);

  if (fotos.length === 0) {
    return <MiniaturaItem descricao={descricao} className={className} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        title={`Ver foto${fotos.length > 1 ? "s" : ""} de ${descricao}`}
        className="relative block cursor-zoom-in rounded transition-opacity hover:opacity-80"
      >
        <MiniaturaItem fotoId={fotos[0]} descricao={descricao} className={className} />

        {fotos.length > 1 && (
          <span
            className={cn(
              "absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full",
              "bg-marca text-[9px] font-bold text-marca-texto",
            )}
          >
            {fotos.length}
          </span>
        )}
      </button>

      <Galeria
        fotos={fotos.map((id) => fotoDaGaleria(id))}
        aberto={aberta}
        aoFechar={() => setAberta(false)}
        titulo={codigo ? `${codigo} — ${descricao}` : descricao}
      />
    </>
  );
}
