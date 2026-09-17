"use client";

import type { InputHTMLAttributes } from "react";

import { Entrada } from "@/components/ui/campo";
import { mascaraMoeda, mascaraNumero, mascaraTelefone, moedaExibida } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

/* Ficam fora de `campo.tsx` pelo mesmo motivo de `campo-senha.tsx`: aquele
   arquivo e importado por pagina de servidor, e estes tem estado. */

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">;

/**
 * Dinheiro no formato caixa registradora.
 *
 * O que a pessoa ve e "1.234,56"; `aoMudar` entrega "1234.56", que e o que o
 * servidor le. Com `name`, esse valor sai num campo escondido — mandar o
 * texto formatado faria `Number("1.234,56")` virar NaN no meio do caminho.
 */
export function CampoMoeda({
  valor,
  aoMudar,
  name,
  className,
  ...props
}: Base & {
  /** Sempre o valor guardado ("1234.56"), nunca o formatado. */
  valor: string;
  aoMudar: (bruto: string) => void;
  name?: string;
}) {
  const exibido = moedaExibida(valor);

  return (
    <>
      {name && <input type="hidden" name={name} value={valor} />}
      <Entrada
        {...props}
        inputMode="decimal"
        value={exibido}
        onChange={(e) => {
          const campo = e.currentTarget;
          aoMudar(mascaraMoeda(campo.value).bruto);
          /* O digito entra pela direita, entao o cursor tem que voltar para o
             fim depois que o React redesenha — senao ele fica preso no meio
             do numero e a digitacao sai embaralhada. */
          requestAnimationFrame(() => {
            const fim = campo.value.length;
            campo.setSelectionRange(fim, fim);
          });
        }}
        onFocus={(e) => {
          const fim = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(fim, fim);
        }}
        className={cn("num text-right", className)}
      />
    </>
  );
}

/**
 * Quantidade: recusa o que nao e numero na propria digitacao.
 *
 * Atende os dois modos porque os formularios daqui usam os dois: com `valor`
 * ele e controlado; com `padrao` fica solto no `<form>` e a limpeza acontece
 * no proprio elemento, sem obrigar cada tela a criar estado so para filtrar
 * tecla.
 */
export function CampoNumero({
  valor,
  aoMudar,
  padrao,
  inteiro,
  className,
  ...props
}: Base & {
  valor?: string;
  aoMudar?: (valor: string) => void;
  /** Valor inicial quando o campo e lido pelo `name`, no envio do form. */
  padrao?: string;
  /** Sem casa decimal — nivel, contagem de peca inteira. */
  inteiro?: boolean;
}) {
  const modo = inteiro ? ("numeric" as const) : ("decimal" as const);

  if (valor !== undefined) {
    return (
      <Entrada
        {...props}
        inputMode={modo}
        /* Normaliza tambem o que chega: o banco devolve 12.5 e a virgula e
           que e a separadora aqui. */
        value={mascaraNumero(valor, inteiro)}
        onChange={(e) => aoMudar?.(mascaraNumero(e.target.value, inteiro))}
        className={cn("num", className)}
      />
    );
  }

  return (
    <Entrada
      {...props}
      inputMode={modo}
      defaultValue={padrao}
      onInput={(e) => {
        const campo = e.currentTarget;
        const limpo = mascaraNumero(campo.value, inteiro);
        /* So escreve quando recusou algo: atribuir sempre jogaria o cursor
           para o fim a cada tecla. */
        if (limpo !== campo.value) campo.value = limpo;
      }}
      className={cn("num", className)}
    />
  );
}

/** Telefone brasileiro, com a pontuacao entrando sozinha. */
export function CampoTelefone({
  valor,
  aoMudar,
  ...props
}: Base & { valor: string; aoMudar: (valor: string) => void }) {
  return (
    <Entrada
      {...props}
      type="tel"
      inputMode="tel"
      value={valor}
      onChange={(e) => aoMudar(mascaraTelefone(e.target.value))}
      placeholder={props.placeholder ?? "(11) 90000-0000"}
    />
  );
}
