"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { NAVEGACAO } from "./navegacao";
import { Marca, MarcaCompleta } from "./marca";
import type { PapelUsuario } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function BarraLateral({
  papel,
  aberta,
  aoFechar,
  recolhida,
  aoDefinirRecolhida,
}: {
  papel: PapelUsuario;
  /** Só no celular: a barra entra por cima da tela. */
  aberta: boolean;
  aoFechar: () => void;
  /** Só no desktop: a barra encolhe para a faixa de ícones. */
  recolhida: boolean;
  aoDefinirRecolhida: (valor: boolean) => void;
}) {
  const caminho = usePathname();

  /**
   * Ao escolher uma tela, o menu sai da frente sozinho — ele serve para
   * escolher o destino, não para ficar ocupando largura depois disso.
   *
   * A checagem de viewport evita gravar uma preferência de desktop a partir
   * do celular, onde a barra some inteira e "recolhida" não significa nada.
   */
  function aoNavegar() {
    aoFechar();
    const noDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (noDesktop && !recolhida) aoDefinirRecolhida(true);
  }

  /* No celular a barra cobre a tela; navegar tem que fechar ela. */
  useEffect(() => {
    aoFechar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho]);

  const itens = NAVEGACAO.filter(
    (i) => !("somenteAdmin" in i && i.somenteAdmin) || papel === "admin",
  );

  return (
    <>
      {aberta && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={aoFechar}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-borda bg-superficie transition-[transform,width] duration-200 lg:static lg:translate-x-0",
          aberta ? "translate-x-0" : "-translate-x-full",
          /* Recolhida vale só a partir do lg — no celular a barra sempre
             abre inteira, onde não existe disputa por espaço horizontal. */
          recolhida ? "w-64 lg:w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-borda",
            recolhida ? "px-5 lg:justify-center lg:px-0" : "px-5",
          )}
        >
          <MarcaCompleta className={recolhida ? "lg:hidden" : ""} />
          <Marca className={cn("size-7 text-marca", recolhida ? "hidden lg:block" : "hidden")} />
        </div>

        <nav className="rolagem-fina flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-3">
          {itens.map(({ href, rotulo, Icone, ...resto }) => {
            const exato = "exato" in resto && resto.exato;
            const ativo = exato ? caminho === href : caminho.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={ativo ? "page" : undefined}
                /* Recolhida, o rótulo vira tooltip do navegador — é a única
                   pista que sobra de para onde o ícone leva. */
                title={recolhida ? rotulo : undefined}
                onClick={aoNavegar}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  recolhida && "lg:justify-center lg:px-0",
                  ativo
                    ? "bg-marca-suave text-marca"
                    : "text-texto-suave hover:bg-superficie-2 hover:text-texto",
                )}
              >
                <Icone className="size-4 shrink-0" />
                <span className={cn("truncate", recolhida && "lg:hidden")}>{rotulo}</span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-borda p-3">
          <button
            type="button"
            onClick={() => aoDefinirRecolhida(!recolhida)}
            title={recolhida ? "Expandir menu" : "Recolher menu"}
            aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-texto-fraco transition-colors hover:bg-superficie-2 hover:text-texto lg:flex",
              recolhida && "lg:justify-center lg:px-0",
            )}
          >
            {recolhida ? (
              <PanelLeftOpen className="size-4 shrink-0" />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" />
            )}
            <span className={cn(recolhida && "lg:hidden")}>Recolher menu</span>
          </button>

          <p
            className={cn(
              "px-2 pt-1 text-[11px] text-texto-fraco",
              recolhida && "lg:hidden",
            )}
          >
            Base compartilhada no Neon
          </p>
        </div>
      </aside>
    </>
  );
}
