"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Texto que se copia num clique — e-mail, telefone, código.
 *
 * Existe porque o caminho de antes era selecionar com o mouse dentro de uma
 * célula de tabela, o que erra a seleção metade das vezes e leva espaço em
 * branco junto. Quem está com o fornecedor na tela quer o e-mail no Ctrl+V,
 * não na mão.
 *
 * O ícone só aparece no hover: são duas colunas inteiras de texto copiável, e
 * um ícone fixo em cada linha viraria ruído. Depois de copiar ele vira um
 * "check" e fica visível por dois segundos — sem isso não há como saber se o
 * clique pegou, já que a área de transferência não dá sinal nenhum.
 */
export function Copiavel({
  valor,
  rotulo,
  className,
}: {
  valor: string;
  /** O que foi copiado, para o leitor de tela e para a dica. */
  rotulo: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
    } catch {
      /* Área de transferência bloqueada (contexto inseguro, permissão negada).
         Não vira erro na cara da pessoa: o texto continua lá para selecionar. */
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? "Copiado" : `Copiar ${rotulo}`}
      aria-label={`Copiar ${rotulo}: ${valor}`}
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 -mx-1 text-left transition-colors hover:bg-superficie-2",
        className,
      )}
    >
      <span className="truncate">{valor}</span>
      {copiado ? (
        <Check className="size-3.5 shrink-0 text-ok" />
      ) : (
        <Copy className="size-3.5 shrink-0 text-texto-fraco opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}
