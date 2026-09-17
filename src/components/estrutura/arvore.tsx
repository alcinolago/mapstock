"use client";

import { ChevronDown, ChevronRight, ChevronUp, Package, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Selo } from "@/components/ui/selo";
import { Montar } from "./montar";
import { desvincularDaEstrutura, moverNaEstrutura } from "@/lib/acoes/estrutura";
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
  /* Unidades desta estrutura que existem montadas hoje. */
  montadas: number;
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
        <No
          key={no.itemId}
          no={no}
          profundidade={0}
          podeEditar={podeEditar}
          primeiro
          ultimo
        />
      ))}
    </ul>
  );
}

function No({
  no,
  profundidade,
  podeEditar,
  primeiro,
  ultimo,
}: {
  no: NoEstrutura;
  profundidade: number;
  podeEditar: boolean;
  /* Nos extremos as setas ficam desabilitadas, em vez de sumirem: assim a
     linha não muda de largura conforme a peça sobe e desce. */
  primeiro: boolean;
  ultimo: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(profundidade < 2);
  const [pendente, iniciar] = useTransition();

  const temFilhos = no.filhos.length > 0;

  function mover(direcao: "cima" | "baixo") {
    if (!no.vinculoId) return;
    iniciar(async () => {
      const r = await moverNaEstrutura(no.vinculoId!, direcao);
      if (r.erro) alert(r.erro);
      else router.refresh();
    });
  }

  async function remover() {
    if (!no.vinculoId) return;
    const r = await desvincularDaEstrutura(no.vinculoId);
    if (r.erro) return r;
    router.refresh();
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

        {no.montadas > 0 && (
          <Selo tom="marca" title="Unidades montadas a partir desta estrutura">
            {no.montadas} montada{no.montadas > 1 ? "s" : ""}
          </Selo>
        )}

        {/* Montar aparece em qualquer nó com componentes, não só na raiz: o
            sub-conjunto é montado antes e entra pronto no equipamento. */}
        {podeEditar && temFilhos && (
          <Montar itemId={no.itemId} codigo={no.codigo} descricao={no.descricao} />
        )}

        {podeEditar && no.vinculoId && (
          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <Botao
              variante="fantasma"
              tamanho="sm"
              onClick={() => mover("cima")}
              disabled={pendente || primeiro}
              title="Subir na ordem de montagem"
              aria-label={`Subir ${no.codigo}`}
              className="px-1.5"
            >
              <ChevronUp className="size-3.5" />
            </Botao>
            <Botao
              variante="fantasma"
              tamanho="sm"
              onClick={() => mover("baixo")}
              disabled={pendente || ultimo}
              title="Descer na ordem de montagem"
              aria-label={`Descer ${no.codigo}`}
              className="px-1.5"
            >
              <ChevronDown className="size-3.5" />
            </Botao>
            <BotaoConfirmar
              rotulo={`Remover ${no.codigo}`}
              Icone={Trash2}
              tamanho="sm"
              somenteIcone
              className="px-1.5"
              iconeClassName="size-3.5 text-perigo"
              dica="Remover desta montagem"
              desabilitado={pendente}
              titulo="Remover da estrutura"
              descricao={`${no.codigo} — ${no.descricao}`}
              rotuloConfirmar="Remover"
              aoConfirmar={remover}
            >
              <p>
                Sai só o vínculo com esta montagem: o cadastro do item, o saldo e o histórico
                dele continuam como estão.
              </p>
            </BotaoConfirmar>
          </div>
        )}
      </div>

      {aberto && temFilhos && (
        <ul>
          {no.filhos.map((f, i) => (
            <No
              key={f.vinculoId ?? f.itemId}
              no={f}
              profundidade={profundidade + 1}
              podeEditar={podeEditar}
              primeiro={i === 0}
              ultimo={i === no.filhos.length - 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
