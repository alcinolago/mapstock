"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

import { Entrada } from "./campo";
import { cn } from "@/lib/utils";

/**
 * Campo de senha com o olhinho de mostrar/ocultar.
 *
 * Existe como componente único porque senha aparece em três telas — login,
 * troca da própria senha e cadastro de usuário — e cada uma com sua própria
 * versão acabaria divergindo. Digitar senha às cegas é onde mais se erra,
 * ainda mais em teclado de celular.
 */
export function CampoSenha({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <Entrada
        {...props}
        type={visivel ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        /* tabIndex -1 mantém o Tab indo direto para o próximo campo: quem
           digita a senha de cor não quer esbarrar no botão no caminho. */
        tabIndex={-1}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visivel}
        title={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-texto-fraco transition-colors hover:text-texto"
      >
        {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
