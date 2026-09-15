import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Cartao({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-borda bg-superficie shadow-[var(--sombra)]",
        className,
      )}
      {...props}
    />
  );
}

export function CabecalhoCartao({
  titulo,
  descricao,
  acao,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-borda px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs text-texto-fraco">{descricao}</p>}
      </div>
      {acao && <div className="flex shrink-0 items-center gap-2">{acao}</div>}
    </div>
  );
}

export function CorpoCartao({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
