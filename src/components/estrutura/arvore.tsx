"use client";

import { ChevronRight, Package, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Selo } from "@/components/ui/selo";
import { desvincularDaEstrutura } from "@/lib/acoes/estrutura";
import { cn, numero } from "@/lib/utils";

export type NoEstrutura = {
  /* id do vinculo em bom; a raiz nao tem vinculo, entao vem nulo */
  vinculoId: string | null;
  itemId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  nivel: number;
  quantidade: number;
  obrigatorio: boolean;
  localMontagem: string | null;
  disponivel: number;
  filhos: NoEstrutura[];
};

export function Arvore({ raizes, podeEditar }: { raizes: NoEstrutura[]; podeEditar: boolean }) {
  if (raizes.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-texto-fraco">
        Nenhum item de Nível 0 cadastrado ainda. A estrutura começa pelo equipamento montado.
      </p>
    );
  }

  return (
    <ul className="p-2">
      {raizes.map((no) => (
        <No key={no.itemId} no={no} profundidade={0} podeEditar={podeEditar} />
      ))}
    </ul>
  );
}

function No({
  no,
  profundidade,
  podeEditar,
}: {
  no: NoEstrutura;
  profundidade: number;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(profundidade < 2);
  const [pendente, iniciar] = useTransition();

  const temFilhos = no.filhos.length > 0;

  function remover() {
    if (!no.vinculoId) return;
    if (!confirm(`Remover ${no.codigo} desta montagem?\n\nO cadastro do item é preservado.`)) {
      return;
    }
    iniciar(async () => {
      const r = await desvincularDaEstrutura(no.vinculoId!);
      if (r.erro) alert(r.erro);
      else router.refresh();
    });
  }

  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-lg py-1.5 pr-2 transition-colors hover:bg-superficie-2"
        style={{ paddingLeft: `${profundidade * 1.25 + 0.5}rem` }}
      >
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-label={aberto ? "Recolher" : "Expandir"}
          disabled={!temFilhos}
          className={cn(
            "rounded p-0.5 text-texto-fraco transition-transform",
            temFilhos ? "hover:text-texto" : "invisible",
            aberto && "rotate-90",
          )}
        >
          <ChevronRight className="size-4" />
        </button>

        <Package
          className={cn(
            "size-4 shrink-0",
            no.nivel === 0 ? "text-marca" : temFilhos ? "text-texto-suave" : "text-texto-fraco",
          )}
        />

        <Link href={`/itens/${no.itemId}`} className="codigo shrink-0 text-xs font-semibold text-marca hover:underline">
          {no.codigo}
        </Link>

        <span className="min-w-0 flex-1 truncate text-sm text-texto">{no.descricao}</span>

        {no.vinculoId && (
          <>
            <span className="num shrink-0 text-xs font-semibold text-texto-suave">
              {numero(no.quantidade)} {no.unidade}
            </span>
            {!no.obrigatorio && <Selo tom="neutro">opcional</Selo>}
            {no.localMontagem && (
              <span className="hidden shrink-0 text-xs text-texto-fraco sm:inline">
                {no.localMontagem}
              </span>
            )}
            {no.nivel > 0 && no.disponivel <= 0 && <Selo tom="perigo">em falta</Selo>}
          </>
        )}

        {podeEditar && no.vinculoId && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            onClick={remover}
            disabled={pendente}
            title="Remover desta montagem"
            className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 className="size-3.5 text-perigo" />
          </Botao>
        )}
      </div>

      {aberto && temFilhos && (
        <ul>
          {no.filhos.map((f) => (
            <No
              key={f.vinculoId ?? f.itemId}
              no={f}
              profundidade={profundidade + 1}
              podeEditar={podeEditar}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
