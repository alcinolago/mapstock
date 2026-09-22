"use client";

import { ChevronRight, Layers, Package } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Selo } from "@/components/ui/selo";
import { cn, numero } from "@/lib/utils";
import { linkDoItem } from "@/lib/voltar";

export type NoMontagem = {
  id: string;
  nome: string | null;
  itemId: string | null;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade: number;
  /** Quanto deste item a montagem inteira consome, já multiplicado. */
  necessario: number;
  localMontagem: string | null;
  disponivel: number;
  filhos: NoMontagem[];
};

/**
 * A árvore copiada do molde na abertura. É registro, não formulário: nada
 * aqui se clica, porque a montagem fecha inteira de uma vez.
 *
 * O que muda de linha para linha é o saldo, e ele só aparece enquanto a
 * montagem está aberta — depois de montada, o saldo de hoje não diz mais
 * nada sobre o que foi consumido naquele dia.
 */
export function ArvoreMontagem({ nos, montada }: { nos: NoMontagem[]; montada: boolean }) {
  if (nos.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-texto-fraco">
        Esta montagem nasceu de uma estrutura vazia.
      </p>
    );
  }

  /* `pb-2` nao e enfeite: a arvore e full-bleed, entao sem ele a ultima linha
     encosta na borda arredondada do cartao e a leitura vira "o conteudo foi
     cortado aqui" em vez de "acabou aqui". */
  return (
    <ul className="divide-y divide-borda pb-2">
      {nos.map((no) => (
        <No key={no.id} no={no} montada={montada} />
      ))}
    </ul>
  );
}

function No({ no, montada }: { no: NoMontagem; montada: boolean }) {
  const [aberto, setAberto] = useState(true);

  const ehDivisao = !no.itemId;
  const temFilhos = no.filhos.length > 0;

  return (
    <li className={cn(ehDivisao && "bg-superficie-2/40")}>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-2 transition-colors",
          ehDivisao ? "bg-superficie-2" : "hover:bg-superficie-2",
          montada && "opacity-70",
        )}
      >
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-label={aberto ? "Recolher" : "Expandir"}
          disabled={!temFilhos}
          className={cn(
            "shrink-0 rounded p-0.5 text-texto-fraco transition-transform",
            temFilhos ? "hover:text-texto" : "invisible",
            aberto && "rotate-90",
          )}
        >
          <ChevronRight className="size-4" />
        </button>

        {ehDivisao ? (
          <Layers className="size-4 shrink-0 text-marca" />
        ) : (
          <Package className="size-4 shrink-0 text-texto-fraco" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {ehDivisao ? (
            <span className="truncate text-sm font-semibold text-texto">{no.nome}</span>
          ) : (
            <>
              <Link
                href={linkDoItem(no.itemId!, "/montagem")}
                className="codigo shrink-0 text-xs font-semibold text-marca hover:underline"
              >
                {no.codigo}
              </Link>
              <span className="min-w-0 truncate text-sm text-texto">{no.descricao}</span>
            </>
          )}

          {no.localMontagem && (
            <span className="hidden shrink-0 text-xs text-texto-fraco xl:inline">
              {no.localMontagem}
            </span>
          )}

          {!ehDivisao && !montada && no.disponivel < no.necessario && (
            <Selo tom={no.disponivel <= 0 ? "perigo" : "alerta"}>
              {no.disponivel <= 0 ? "sem saldo" : `só ${numero(no.disponivel)}`}
            </Selo>
          )}
        </div>

        <span className="num w-24 shrink-0 text-right text-xs font-semibold text-texto-suave">
          {numero(no.quantidade)}
          <span className="text-texto-fraco">{no.unidade ? ` ${no.unidade}` : " ×"}</span>
        </span>
      </div>

      {aberto && ehDivisao && !temFilhos && (
        <p className="ml-[1.6rem] border-l border-borda py-2 pl-5 text-xs text-texto-fraco">
          Esta divisão está vazia.
        </p>
      )}

      {aberto && temFilhos && (
        <ul className="ml-[1.6rem] divide-y divide-borda border-l border-borda">
          {no.filhos.map((f) => (
            <No key={f.id} no={f} montada={montada} />
          ))}
        </ul>
      )}
    </li>
  );
}
