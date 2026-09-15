"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { PAPEIS, type PapelUsuario } from "@/lib/labels";
import { sair } from "@/lib/acoes/sessao";

export function MenuUsuario({
  nome,
  email,
  papel,
}: {
  nome: string;
  email: string;
  papel: PapelUsuario;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 transition-colors hover:bg-superficie-2"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-marca-suave text-xs font-bold text-marca">
          {iniciais || <UserRound className="size-4" />}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-xs font-semibold text-texto">{nome}</span>
          <span className="block text-[10px] text-texto-fraco">{PAPEIS[papel]}</span>
        </span>
        <ChevronDown className="size-4 text-texto-fraco" />
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-borda bg-superficie shadow-lg"
        >
          <div className="border-b border-borda px-4 py-3">
            <p className="truncate text-sm font-semibold text-texto">{nome}</p>
            <p className="truncate text-xs text-texto-fraco">{email}</p>
          </div>
          <Link
            href="/conta"
            onClick={() => setAberto(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-texto-suave transition-colors hover:bg-superficie-2 hover:text-texto"
          >
            <UserRound className="size-4" />
            Minha conta
          </Link>

          <form action={sair} className="border-t border-borda">
            <Botao
              type="submit"
              variante="fantasma"
              className="w-full justify-start rounded-none px-4 text-perigo hover:bg-perigo-suave hover:text-perigo"
            >
              <LogOut className="size-4" />
              Sair
            </Botao>
          </form>
        </div>
      )}
    </div>
  );
}
