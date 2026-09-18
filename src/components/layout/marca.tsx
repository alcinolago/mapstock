import { cn } from "@/lib/utils";

/**
 * Marca do MapStock: tres camadas empilhadas, do cheio ao vazio — a leitura
 * visual de nível de estoque, que e o que o sistema faz.
 */
export function Marca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect x="4" y="19" width="24" height="7" rx="2" fill="currentColor" />
      <rect x="4" y="11" width="24" height="7" rx="2" fill="currentColor" opacity="0.6" />
      <rect
        x="4.75"
        y="3.75"
        width="22.5"
        height="5.5"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.75"
      />
    </svg>
  );
}

export function MarcaCompleta({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Marca className="size-7 text-marca" />
      <div className="leading-none">
        <span className="text-base font-bold tracking-tight text-texto">MapStock</span>
        <span className="mt-1 block text-[10px] font-medium tracking-[0.14em] text-texto-fraco">
          MAPZER
        </span>
      </div>
    </div>
  );
}
