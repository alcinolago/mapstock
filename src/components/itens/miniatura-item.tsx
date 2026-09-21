import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A foto principal do item em tamanho de lista.
 *
 * Sempre pede `?mini=1`: a copia de 200px pesa uns 10 KB, e uma pagina de 50
 * itens com a foto inteira seriam 10 MB para preencher quadrados de 32px.
 *
 * Sem foto, desenha o quadro vazio em vez de nao desenhar nada — a coluna
 * some do alinhamento se cada linha decidir sozinha se ocupa espaco.
 */
export function MiniaturaItem({
  fotoId,
  descricao,
  className,
}: {
  fotoId?: string;
  descricao: string;
  className?: string;
}) {
  const caixa = cn(
    "size-8 shrink-0 overflow-hidden rounded border border-borda bg-superficie-2",
    className,
  );

  if (!fotoId) {
    return (
      <div className={cn(caixa, "flex items-center justify-center")} aria-hidden>
        <ImageIcon className="size-3.5 text-texto-fraco/50" />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- bytes servidos pela
       propria aplicacao; nao passam pelo otimizador de imagem do Next. */
    <img
      src={`/api/fotos/${fotoId}?mini=1`}
      alt={`Foto de ${descricao}`}
      loading="lazy"
      className={cn(caixa, "object-cover")}
    />
  );
}
