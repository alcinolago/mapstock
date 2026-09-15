"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AlternarTema } from "./alternar-tema";
import { BarraLateral } from "./barra-lateral";
import { Marca } from "./marca";
import { MenuUsuario } from "./menu-usuario";
import type { Sessao } from "@/lib/sessao";

export function Casca({ sessao, children }: { sessao: Sessao; children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <BarraLateral
        papel={sessao.papel}
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
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
