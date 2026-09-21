"use client";

import { Check, ChevronRight, Layers, Package } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Selo } from "@/components/ui/selo";
import { MontarNo } from "./montar-no";
import { cn, dataHora, numero } from "@/lib/utils";
import { linkDoItem } from "@/lib/voltar";

export type NoMontagem = {
  id: string;
  nome: string | null;
  itemId: string | null;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade: number;
  obrigatorio: boolean;
  localMontagem: string | null;
  disponivel: number;
  montadoEm: Date | null;
  montadoPor: string | null;
  filhos: NoMontagem[];
};

export function ArvoreMontagem({
  montagemId,
  nos,
  podeEditar,
  encerrada,
}: {
  montagemId: string;
  nos: NoMontagem[];
  podeEditar: boolean;
  /** Montagem concluída ou desmontada: a árvore vira histórico. */
  encerrada: boolean;
}) {
  if (nos.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-texto-fraco">
        Esta montagem nasceu de um molde vazio.
      </p>
    );
  }

  /* Mesma leitura da arvore do molde: coluna fixa a direita, linha entre os
     irmaos e recuo com fio. As duas telas mostram a mesma arvore, entao
     mostrar de dois jeitos diferentes so daria trabalho a quem le. */
  return (
    <ul className="divide-y divide-borda">
      {nos.map((no) => (
        <No
          key={no.id}
          no={no}
          montagemId={montagemId}
          podeEditar={podeEditar}
          encerrada={encerrada}
        />
      ))}
    </ul>
  );
}

function No({
  no,
  montagemId,
  podeEditar,
  encerrada,
}: {
  no: NoMontagem;
  montagemId: string;
  podeEditar: boolean;
  encerrada: boolean;
}) {
  const [aberto, setAberto] = useState(!no.montadoEm);

  const ehDivisao = !no.itemId;
  const temFilhos = no.filhos.length > 0;
  const montado = Boolean(no.montadoEm);

  /* Só pode fechar quando todos os filhos estão prontos: peça com saldo,
     divisão já montada. A ação confere de novo no servidor. */
  const pronto = no.filhos.every((f) =>
    f.itemId ? f.disponivel >= f.quantidade : Boolean(f.montadoEm),
  );

  return (
    <li className={cn(ehDivisao && "bg-superficie-2/40")}>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-2 transition-colors",
          ehDivisao ? "bg-superficie-2" : "hover:bg-superficie-2",
          montado && "opacity-70",
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
          <Layers className={cn("size-4 shrink-0", montado ? "text-ok" : "text-marca")} />
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

          {!no.obrigatorio && <Selo tom="neutro">opcional</Selo>}

          {no.localMontagem && (
            <span className="hidden shrink-0 text-xs text-texto-fraco xl:inline">
              {no.localMontagem}
            </span>
          )}

          {montado ? (
            <Selo
              tom="ok"
              title={`${dataHora(no.montadoEm)}${no.montadoPor ? ` · ${no.montadoPor}` : ""}`}
            >
              <Check className="size-3" />
              montada
            </Selo>
          ) : (
            /* Peça dentro de divisão já montada não mostra falta: ela já saiu
               do estoque, e o saldo de hoje não diz nada sobre ela. */
            !ehDivisao &&
            no.disponivel < no.quantidade && (
              <Selo tom={no.disponivel <= 0 ? "perigo" : "alerta"}>
                {no.disponivel <= 0 ? "sem saldo" : `só ${numero(no.disponivel)}`}
              </Selo>
            )
          )}
        </div>

        <span className="num w-24 shrink-0 text-right text-xs font-semibold text-texto-suave">
          {numero(no.quantidade)}
          <span className="text-texto-fraco">{no.unidade ? ` ${no.unidade}` : " ×"}</span>
        </span>

        <div className="flex w-32 shrink-0 items-center justify-end">
          {podeEditar && ehDivisao && !montado && !encerrada && pronto && (
            <MontarNo montagemId={montagemId} noId={no.id} rotulo="Montar" />
          )}
        </div>
      </div>

      {aberto && ehDivisao && !temFilhos && (
        <p className="ml-[1.6rem] border-l border-borda py-2 pl-5 text-xs text-texto-fraco">
          Esta divisão está vazia.
        </p>
      )}

      {aberto && temFilhos && (
        <ul className="ml-[1.6rem] divide-y divide-borda border-l border-borda">
          {no.filhos.map((f) => (
            <No
              key={f.id}
              no={f}
              montagemId={montagemId}
              podeEditar={podeEditar}
              encerrada={encerrada || montado}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
