import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

/* text-base no celular e text-sm a partir do sm: o Safari do iPhone dá zoom
   sozinho em qualquer campo com fonte menor que 16px, e a tela inteira fica
   torta depois — a pessoa toca no campo de busca e perde o resto da página. */
const base =
  "w-full rounded-lg border border-borda-forte bg-superficie px-3 text-base text-texto transition-colors placeholder:text-texto-fraco hover:border-marca/50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm";

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-10", className)} {...props} />;
}

export function AreaTexto({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

export function Selecao({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        base,
        "h-10 cursor-pointer appearance-none bg-[length:1.1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')]",
        className,
      )}
      {...props}
    />
  );
}

export function Rotulo({
  className,
  obrigatorio,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { obrigatorio?: boolean }) {
  return (
    <label
      className={cn("text-xs font-semibold tracking-wide text-texto-suave", className)}
      {...props}
    >
      {children}
      {obrigatorio && <span className="ml-0.5 text-perigo">*</span>}
    </label>
  );
}

/** Rotulo + controle + mensagem de erro/ajuda, com o espacamento padrao. */
export function Grupo({
  rotulo,
  obrigatorio,
  erro,
  ajuda,
  htmlFor,
  className,
  children,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  erro?: string;
  ajuda?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Rotulo htmlFor={htmlFor} obrigatorio={obrigatorio}>
        {rotulo}
      </Rotulo>
      {children}
      {erro ? (
        <p className="text-xs font-medium text-perigo">{erro}</p>
      ) : ajuda ? (
        <p className="text-xs text-texto-fraco">{ajuda}</p>
      ) : null}
    </div>
  );
}
