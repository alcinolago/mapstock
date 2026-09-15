import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Envolve a tabela: rola na horizontal sem estourar o layout no celular. */
export function RolagemTabela({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rolagem-fina w-full overflow-x-auto", className)} {...props} />;
}

export function Tabela({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function Cabecalho({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-superficie-2", className)} {...props} />;
}

export function Corpo({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-borda", className)} {...props} />;
}

export function Linha({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-superficie-2", className)} {...props} />;
}

export function Coluna({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-borda px-3 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-texto-suave",
        className,
      )}
      {...props}
    />
  );
}

export function Celula({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 align-middle text-texto", className)} {...props} />;
}

export function Vazio({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center text-sm text-texto-fraco">
        {children}
      </td>
    </tr>
  );
}
