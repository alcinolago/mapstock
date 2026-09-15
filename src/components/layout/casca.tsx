"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AlternarTema } from "./alternar-tema";
import { BarraLateral } from "./barra-lateral";
import { Marca } from "./marca";
import { MenuUsuario } from "./menu-usuario";
import { COOKIE_MENU } from "./preferencias";
import type { Sessao } from "@/lib/sessao";

export function Casca({
  sessao,
  menuRecolhido,
  children,
}: {
  sessao: Sessao;
  /** Vem do cookie, lido no servidor: a barra já renderiza no estado certo. */
  menuRecolhido: boolean;
  children: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [recolhida, setRecolhida] = useState(menuRecolhido);

  function alternarRecolher() {
    const novo = !recolhida;
    setRecolhida(novo);
    /* Cookie em vez de localStorage: o layout roda no servidor e precisa
       saber a preferência antes do primeiro render, senão a barra pisca
       aberta e encolhe depois da hidratação. Um ano é tempo de sobra. */
    document.cookie = `${COOKIE_MENU}=${novo ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex min-h-dvh">
      <BarraLateral
        papel={sessao.papel}
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        recolhida={recolhida}
        aoAlternarRecolher={alternarRecolher}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-borda bg-superficie/85 px-4 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="rounded-lg p-2 text-texto-suave transition-colors hover:bg-superficie-2 lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <Marca className="size-6 text-marca lg:hidden" />

          <div className="flex-1" />
          <AlternarTema />
          <MenuUsuario nome={sessao.nome} email={sessao.email} papel={sessao.papel} />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
