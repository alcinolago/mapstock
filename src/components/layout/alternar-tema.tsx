"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const OPCOES = [
  { valor: "light", rotulo: "Claro", Icone: Sun },
  { valor: "dark", rotulo: "Escuro", Icone: Moon },
  { valor: "system", rotulo: "Sistema", Icone: Monitor },
] as const;

export function AlternarTema() {
  const { theme, setTheme } = useTheme();

  /* O tema so existe no cliente: no servidor nao da pra saber qual esta
     ativo. Ate a hidratacao terminar, nenhum botao aparece marcado — assim
     o HTML do servidor e o do cliente batem e nada pisca. */
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div
      role="group"
      aria-label="Tema da interface"
      className="flex items-center gap-0.5 rounded-lg border border-borda bg-superficie-2 p-0.5"
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => {
        const ativo = montado && theme === valor;
        return (
          <button
            key={valor}
            type="button"
            onClick={() => setTheme(valor)}
            title={rotulo}
            aria-label={rotulo}
            aria-pressed={ativo}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              ativo
                ? "bg-superficie text-marca shadow-[var(--sombra)]"
                : "text-texto-fraco hover:text-texto",
            )}
          >
            <Icone className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
