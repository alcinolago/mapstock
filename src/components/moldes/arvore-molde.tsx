"use client";

import { ChevronDown, ChevronRight, ChevronUp, Package, Layers, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ItemBusca } from "@/components/estoque/seletor-item";
import { Botao } from "@/components/ui/botao";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Selo } from "@/components/ui/selo";
import { AdicionarNo, type OpcaoDivisao } from "./adicionar-no";
import { moverNo, removerNo } from "@/lib/acoes/moldes";
import { cn, moeda, numero } from "@/lib/utils";
import { linkDoItem } from "@/lib/voltar";

export type NoMolde = {
  id: string;
  /** Divisão: o nome. Peça: null. */
  nome: string | null;
  itemId: string | null;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade: number;
  localMontagem: string | null;
  disponivel: number;
  /** Custo somado de tudo que está abaixo deste nó, já multiplicado. */
  custoTotal: number;
  /** Este item tem estrutura própria: os filhos abaixo vieram dela. */
  ehConjunto: boolean;
  /** Veio de dentro de um conjunto — mostra, não edita. */
  doConjunto: boolean;
  filhos: NoMolde[];
};

/**
 * A arvore do molde.
 *
 * Tres coisas seguram a leitura, e todas nasceram de a tela ter ficado
 * confusa sem elas:
 *
 * - **Coluna fixa a direita.** Quantidade, custo e botoes tem largura
 *   propria, entao alinham de cima a baixo. Soltos no flex, cada linha
 *   terminava num lugar diferente conforme o tamanho da descricao, e ficava
 *   dificil dizer o que era o que.
 * - **Linha entre os itens.** `divide-y` separa irmaos; como cada `<li>`
 *   carrega os proprios filhos, a linha entre dois `<li>` do primeiro nivel
 *   separa blocos inteiros, e nao so duas linhas de texto.
 * - **Recuo com fio.** O filho entra por uma lista com borda a esquerda, em
 *   vez de padding calculado. O fio mostra ate onde a divisao vai.
 */
export function ArvoreMolde({
  moldeId,
  nos,
  divisoes,
  itens,
  podeEditar,
}: {
  moldeId: string;
  nos: NoMolde[];
  divisoes: OpcaoDivisao[];
  itens: ItemBusca[];
  podeEditar: boolean;
}) {
  if (nos.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-texto-fraco">
        Estrutura vazia. Use <strong className="font-semibold text-texto-suave">Adicionar</strong>{" "}
        aqui em cima para criar a primeira divisão.
      </p>
    );
  }

  /* `pb-2` nao e enfeite: a arvore e full-bleed, entao sem ele a ultima linha
     encosta na borda arredondada do cartao e a leitura vira "o conteudo foi
     cortado aqui" em vez de "acabou aqui". */
  return (
    <ul className="divide-y divide-borda pb-2">
      {nos.map((no, i) => (
        <No
          key={no.id}
          no={no}
          moldeId={moldeId}
          divisoes={divisoes}
          itens={itens}
          podeEditar={podeEditar}
          primeiro={i === 0}
          ultimo={i === nos.length - 1}
        />
      ))}
    </ul>
  );
}

function No({
  no,
  moldeId,
  divisoes,
  itens,
  podeEditar,
  primeiro,
  ultimo,
}: {
  no: NoMolde;
  moldeId: string;
  divisoes: OpcaoDivisao[];
  itens: ItemBusca[];
  podeEditar: boolean;
  /* Nos extremos as setas ficam desabilitadas, em vez de sumirem: assim a
     linha não muda de largura conforme a peça sobe e desce. */
  primeiro: boolean;
  ultimo: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(true);
  const [pendente, iniciar] = useTransition();

  const ehDivisao = !no.itemId;
  const temFilhos = no.filhos.length > 0;

  /* O que veio de dentro de um conjunto não se edita aqui. O equipamento aponta
     para o domo; quem define o domo é a estrutura do domo, lá embaixo na
     seção Itens — e editar por dois lugares é como um deles fica errado. */
  const editavel = podeEditar && !no.doConjunto;

  function mover(direcao: "cima" | "baixo") {
    iniciar(async () => {
      const r = await moverNo(no.id, direcao);
      if (!r.erro) router.refresh();
    });
  }

  return (
    <li className={cn(ehDivisao && "bg-superficie-2/40")}>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-2 transition-colors",
          ehDivisao ? "bg-superficie-2" : "hover:bg-superficie-2",
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

        {/* Área elástica: nome e selos. Tudo que vem depois tem largura fixa. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {ehDivisao ? (
            <span className="truncate text-sm font-semibold text-texto">{no.nome}</span>
          ) : (
            <>
              <Link
                href={linkDoItem(no.itemId!, "/estrutura")}
                className="codigo shrink-0 text-xs font-semibold text-marca hover:underline"
              >
                {no.codigo}
              </Link>
              <span className="min-w-0 truncate text-sm text-texto">{no.descricao}</span>
            </>
          )}

          {ehDivisao && temFilhos && (
            <span className="shrink-0 text-xs text-texto-fraco">
              {no.filhos.length} {no.filhos.length === 1 ? "item" : "itens"}
            </span>
          )}

          {no.ehConjunto && (
            <Selo tom="marca" title="Montado a partir da estrutura deste item, na seção Itens">
              conjunto
            </Selo>
          )}

          {no.localMontagem && (
            <span className="hidden shrink-0 text-xs text-texto-fraco xl:inline">
              {no.localMontagem}
            </span>
          )}

          {/* Falta aqui é só informação de planejamento: o molde não depende
              de ter peça. Quem barra por saldo é a montagem. */}
          {!ehDivisao && no.disponivel < no.quantidade && (
            <Selo tom={no.disponivel <= 0 ? "perigo" : "alerta"}>
              {no.disponivel <= 0 ? "sem saldo" : `só ${numero(no.disponivel)}`}
            </Selo>
          )}
        </div>

        <span className="num w-24 shrink-0 text-right text-xs font-semibold text-texto-suave">
          {numero(no.quantidade)}
          <span className="text-texto-fraco">{no.unidade ? ` ${no.unidade}` : " ×"}</span>
        </span>

        <span className="num hidden w-24 shrink-0 text-right text-xs text-texto-fraco sm:inline">
          {no.custoTotal > 0 ? moeda(no.custoTotal) : "—"}
        </span>

        {/* A coluna fica reservada mesmo sem botão: linha de conjunto não edita,
            e sem a largura as quantidades desalinhariam entre um nível e o
            outro justamente onde a leitura importa. */}
        {podeEditar && (
          <div className="flex w-28 shrink-0 items-center justify-end">
            {editavel && (
              <>
            {ehDivisao ? (
              <AdicionarNo
                moldeId={moldeId}
                paiId={no.id}
                paiNome={no.nome ?? "esta divisão"}
                divisoes={divisoes}
                itens={itens}
                compacto
              />
            ) : (
              <span className="w-8" aria-hidden />
            )}

            <Botao
              variante="fantasma"
              tamanho="sm"
              onClick={() => mover("cima")}
              disabled={pendente || primeiro}
              title="Subir na ordem de montagem"
              aria-label={`Subir ${no.nome ?? no.codigo}`}
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
              aria-label={`Descer ${no.nome ?? no.codigo}`}
              className="px-1.5"
            >
              <ChevronDown className="size-3.5" />
            </Botao>
            <BotaoConfirmar
              rotulo={`Remover ${no.nome ?? no.codigo}`}
              Icone={Trash2}
              tamanho="sm"
              somenteIcone
              className="px-1.5"
              iconeClassName="size-3.5 text-perigo"
              dica="Tirar da estrutura"
              desabilitado={pendente}
              titulo="Tirar da estrutura"
              descricao={no.nome ?? `${no.codigo} — ${no.descricao}`}
              rotuloConfirmar="Tirar"
              aoConfirmar={async () => {
                const r = await removerNo(no.id);
                if (r.erro) return r;
                router.refresh();
              }}
            >
              <p>
                {temFilhos
                  ? `Leva junto ${no.filhos.length} ${no.filhos.length === 1 ? "item" : "itens"} que estão dentro.`
                  : "Sai só desta estrutura."}{" "}
                O molde é planejamento: nada disso mexe no estoque, e montagens já abertas
                seguem com a cópia delas.
              </p>
            </BotaoConfirmar>
              </>
            )}
          </div>
        )}
      </div>

      {aberto && ehDivisao && !temFilhos && (
        <p className="ml-[1.6rem] border-l border-borda py-2 pl-5 text-xs text-texto-fraco">
          Nenhuma peça nesta divisão ainda.
        </p>
      )}

      {aberto && temFilhos && (
        <ul className="ml-[1.6rem] divide-y divide-borda border-l border-borda">
          {no.filhos.map((f, i) => (
            <No
              key={f.id}
              no={f}
              moldeId={moldeId}
              divisoes={divisoes}
              itens={itens}
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
