"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { NAVEGACAO } from "./navegacao";
import { MarcaCompleta } from "./marca";
import type { PapelUsuario } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function BarraLateral({
  papel,
  aberta,
  aoFechar,
}: {
  papel: PapelUsuario;
  aberta: boolean;
  aoFechar: () => void;
}) {
  const caminho = usePathname();

  /* No celular a barra cobre a tela; navegar tem que fechar ela. */
  useEffect(() => {
    aoFechar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho]);

  const itens = NAVEGACAO.filter((i) => !("somenteAdmin" in i && i.somenteAdmin) || papel === "admin");

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
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-borda bg-superficie transition-transform lg:static lg:translate-x-0",
          aberta ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-borda px-5">
          <MarcaCompleta />
        </div>

        <nav className="rolagem-fina flex-1 space-y-0.5 overflow-y-auto p-3">
          {itens.map(({ href, rotulo, Icone, ...resto }) => {
            const exato = "exato" in resto && resto.exato;
            const ativo = exato ? caminho === href : caminho.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-marca-suave text-marca"
                    : "text-texto-suave hover:bg-superficie-2 hover:text-texto",
                )}
              >
                <Icone className="size-4 shrink-0" />
                {rotulo}
              </Link>
            );
          })}
        </nav>

        <p className="shrink-0 border-t border-borda px-5 py-3 text-[11px] text-texto-fraco">
          Base compartilhada no Neon
        </p>
      </aside>
    </>
  );
}
