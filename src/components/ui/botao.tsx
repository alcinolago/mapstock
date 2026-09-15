import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * As variantes seguem as cores que o sistema desktop ja usava para cada acao:
 * azul para a acao principal, verde para salvar, vermelho para excluir e
 * ambar para lancar movimentacao.
 */
const botao = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variante: {
        primario: "bg-marca text-marca-texto hover:opacity-90",
        salvar: "bg-ok text-white hover:opacity-90 dark:text-[#06231a]",
        perigo: "bg-perigo text-white hover:opacity-90 dark:text-[#2b0b0b]",
        movimento: "bg-alerta text-white hover:opacity-90 dark:text-[#2b1e04]",
        contorno:
          "border border-borda-forte bg-superficie text-texto hover:bg-superficie-2",
        suave: "bg-superficie-2 text-texto-suave hover:bg-borda",
        fantasma: "text-texto-suave hover:bg-superficie-2 hover:text-texto",
      },
      tamanho: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-sm",
        icone: "size-9 p-0",
      },
    },
    defaultVariants: { variante: "primario", tamanho: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof botao>;

export function Botao({ className, variante, tamanho, ...props }: Props) {
  return <button className={cn(botao({ variante, tamanho }), className)} {...props} />;
}

export { botao };
