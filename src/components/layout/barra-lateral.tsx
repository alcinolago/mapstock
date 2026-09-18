"use client";

import { ChevronRight, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

import { folhas, NAVEGACAO } from "./navegacao";
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
  /** Só no celular e no tablet: a barra entra por cima da tela. */
  aberta: boolean;
  aoFechar: () => void;
  /** Só no desktop: a barra encolhe para a faixa de ícones. */
  recolhida: boolean;
  aoDefinirRecolhida: (valor: boolean) => void;
}) {
  const caminho = usePathname();

  /* A barra fica como a pessoa deixou, em qualquer largura: navegar não
     fecha nem recolhe nada. Antes ela se fechava sozinha ao escolher uma
     tela — e como o menu é o lugar de onde se anda pelo sistema, isso
     obrigava a reabrir a cada passo. Quem quiser fechar usa o X (no celular
     e no tablet) ou o botão de recolher (no desktop), e o cookie lembra. */

  const itens = NAVEGACAO.filter(
    (i) => !("somenteAdmin" in i && i.somenteAdmin) || papel === "admin",
  );

  return (
    <>
      {/* Só escurece o que está atrás. Fechar no clique de fora derrubava a
          barra sem querer, que é o oposto do que se pediu dela. */}
      {aberta && <div aria-hidden className="fixed inset-0 z-30 bg-veu lg:hidden" />}

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
            "flex h-16 shrink-0 items-center gap-2 border-b border-borda",
            recolhida ? "px-5 lg:justify-center lg:px-0" : "px-5",
          )}
        >
          <MarcaCompleta className={recolhida ? "lg:hidden" : ""} />
          <Marca className={cn("size-7 text-marca", recolhida ? "hidden lg:block" : "hidden")} />

          {/* No desktop a barra é fixa e não tem o que fechar. */}
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar menu"
            className="ml-auto shrink-0 rounded-lg p-2 text-texto-suave transition-colors hover:bg-superficie-2 hover:text-texto lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="rolagem-fina flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-3">
          {itens.map((item) => {
            /* Recolhida, o grupo se desfaz: nao ha largura para o rotulo do
               pai nem para o recuo do filho, e esconder os filhos atras de um
               icone deixaria telas inteiras sem caminho. */
            if ("filhos" in item && !recolhida) {
              return <Grupo key={item.href} item={item} caminho={caminho} />;
            }
            return folhas(item).map((f) => (
              <Atalho
                key={f.href}
                href={f.href}
                rotulo={f.rotulo}
                Icone={f.Icone}
                ativo={ehAtivo(f, caminho)}
                recolhida={recolhida}
              />
            ));
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

type Folha = {
  readonly href: string;
  readonly rotulo: string;
  readonly Icone: LucideIcon;
  readonly exato?: boolean;
};

/* "/" combina com o começo de tudo, então só ele compara por igualdade. */
function ehAtivo(item: Folha, caminho: string) {
  return item.exato ? caminho === item.href : caminho.startsWith(item.href);
}

function Atalho({
  href,
  rotulo,
  Icone,
  ativo,
  recolhida,
  dentroDeGrupo = false,
}: {
  href: string;
  rotulo: string;
  Icone: LucideIcon;
  ativo: boolean;
  recolhida: boolean;
  dentroDeGrupo?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      /* Recolhida, o rótulo vira tooltip do navegador — é a única pista que
         sobra de para onde o ícone leva. */
      title={recolhida ? rotulo : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        recolhida && "lg:justify-center lg:px-0",
        dentroDeGrupo && "ml-3 border-l border-borda pl-4",
        ativo
          ? "bg-marca-suave text-marca"
          : "text-texto-suave hover:bg-superficie-2 hover:text-texto",
      )}
    >
      <Icone className="size-4 shrink-0" />
      <span className={cn("truncate", recolhida && "lg:hidden")}>{rotulo}</span>
    </Link>
  );
}

function Grupo({
  item,
  caminho,
}: {
  item: { readonly rotulo: string; readonly Icone: LucideIcon; readonly filhos: readonly Folha[] };
  caminho: string;
}) {
  const temAtivo = item.filhos.some((f) => ehAtivo(f, caminho));

  const [aberto, setAberto] = useState(temAtivo);
  const [ultimoAtivo, setUltimoAtivo] = useState(temAtivo);

  /* Entrar numa tela do grupo abre o grupo, inclusive quando a pessoa chegou
     por um link de outra tela. Sair não fecha: fechar sozinho tiraria da
     frente justamente o caminho de volta. */
  if (temAtivo !== ultimoAtivo) {
    setUltimoAtivo(temAtivo);
    if (temAtivo) setAberto(true);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          temAtivo ? "text-texto" : "text-texto-suave hover:bg-superficie-2 hover:text-texto",
        )}
      >
        <item.Icone className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.rotulo}</span>
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-texto-fraco transition-transform",
            aberto && "rotate-90",
          )}
        />
      </button>

      {aberto && (
        <div className="mt-0.5 space-y-0.5">
          {item.filhos.map((f) => (
            <Atalho
              key={f.href}
              href={f.href}
              rotulo={f.rotulo}
              Icone={f.Icone}
              ativo={ehAtivo(f, caminho)}
              recolhida={false}
              dentroDeGrupo
            />
          ))}
        </div>
      )}
    </div>
  );
}
