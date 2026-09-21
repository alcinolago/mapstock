"use client";

import { Check, ChevronRight, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { SeletorItem, type ItemBusca } from "@/components/estoque/seletor-item";
import { Botao } from "@/components/ui/botao";
import { Selecao } from "@/components/ui/campo";
import { CampoMoeda, CampoNumero } from "@/components/ui/campo-mascarado";
import { Selo } from "@/components/ui/selo";
import { RolagemTabela } from "@/components/ui/tabela";
import {
  adicionarItemNaCotacao,
  atualizarQuantidadeCotacao,
  escolherFornecedor,
  removerItemDaCotacao,
  removerPrecoCotado,
  salvarPrecoCotado,
} from "@/lib/acoes/compras";
import { cn, moeda, numero, paraNumero } from "@/lib/utils";

export type PrecoCotado = {
  id: string;
  fornecedorId: string;
  precoUnitario: number;
  prazoValor: number;
  prazoUnidade: "horas" | "dias";
  frete: number;
  escolhido: boolean;
};

export type ItemCotado = {
  id: string;
  itemId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precos: PrecoCotado[];
  /** Os fornecedores que este item tem no cadastro. */
  fornecedoresDoItem: { id: string; nome: string }[];
};

type Agir = (fn: () => Promise<unknown>) => void;

/**
 * O comparativo de precos, um bloco por item.
 *
 * Era uma tabela unica com todo fornecedor virando coluna global. Numa
 * cotacao de dois itens ja confundia — o fornecedor que atendia so um deles
 * abria coluna vazia no outro —, e com trinta itens virava rolagem
 * horizontal sem fim, com a maior parte da grade vazia.
 *
 * Agora cada item traz embaixo de si so os fornecedores que interessam a ele:
 * os do cadastro, mais quem ja tiver preco lancado aqui. Quando um item tem
 * fornecedor demais, a rolagem lateral fica presa naquele item, e nao na
 * pagina inteira.
 */
export function Comparativo({
  cotacaoId,
  itensCotados,
  fornecedores,
  itensDisponiveis,
  editavel,
}: {
  cotacaoId: string;
  itensCotados: ItemCotado[];
  fornecedores: { id: string; nome: string }[];
  itensDisponiveis: ItemBusca[];
  editavel: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [novoItem, setNovoItem] = useState<string>();
  const [novaQtd, setNovaQtd] = useState("1");

  /* Fornecedor acrescentado a mao, por item. Some quando o preco e salvo —
     dali em diante ele entra pela propria lista de precos. */
  const [extras, setExtras] = useState<Record<string, string[]>>({});

  /* O que ja foi decidido nasce recolhido: numa cotacao longa, a tela vai
     encurtando conforme cada item fecha. Depois disso quem manda e o clique,
     nao o estado do item — recolher sozinho debaixo da mao de quem acabou de
     escolher seria pior que a rolagem. */
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      itensCotados.map((i) => [i.id, !i.precos.some((p) => p.escolhido)]),
    ),
  );

  /* Total por fornecedor considerando so os itens em que ele venceu. */
  const totaisEscolhidos = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const item of itensCotados) {
      const vencedor = item.precos.find((p) => p.escolhido);
      if (!vencedor) continue;
      mapa.set(
        vencedor.fornecedorId,
        (mapa.get(vencedor.fornecedorId) ?? 0) + vencedor.precoUnitario * item.quantidade,
      );
    }
    return mapa;
  }, [itensCotados]);

  const totalGeral = [...totaisEscolhidos.values()].reduce((s, v) => s + v, 0);
  const semEscolha = itensCotados.filter((i) => !i.precos.some((p) => p.escolhido)).length;

  function agir(fn: () => Promise<unknown>) {
    iniciar(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {editavel && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-borda bg-superficie p-3">
          <div className="min-w-64 flex-1">
            <SeletorItem
              itens={itensDisponiveis.filter(
                (i) => !itensCotados.some((c) => c.itemId === i.id),
              )}
              valor={novoItem}
              aoEscolher={setNovoItem}
            />
          </div>
          <CampoNumero
            valor={novaQtd}
            aoMudar={setNovaQtd}
            className="w-24"
            aria-label="Quantidade"
          />
          <Botao
            variante="contorno"
            disabled={!novoItem || pendente}
            onClick={() =>
              agir(async () => {
                const r = await adicionarItemNaCotacao(
                  cotacaoId,
                  novoItem!,
                  paraNumero(novaQtd, 1),
                );
                if (r.erro) alert(r.erro);
                setNovoItem(undefined);
                setNovaQtd("1");
              })
            }
          >
            <Plus className="size-4" />
            Adicionar item
          </Botao>

          {itensCotados.length > 1 && (
            <div className="ml-auto flex gap-1">
              <Botao
                variante="fantasma"
                tamanho="sm"
                onClick={() =>
                  setAbertos(Object.fromEntries(itensCotados.map((i) => [i.id, true])))
                }
              >
                Expandir tudo
              </Botao>
              <Botao
                variante="fantasma"
                tamanho="sm"
                onClick={() =>
                  setAbertos(Object.fromEntries(itensCotados.map((i) => [i.id, false])))
                }
              >
                Recolher tudo
              </Botao>
            </div>
          )}
        </div>
      )}

      {itensCotados.length === 0 ? (
        <p className="rounded-xl border border-borda bg-superficie px-4 py-14 text-center text-sm text-texto-fraco">
          Nenhum item nesta cotação ainda. Adicione acima o que você precisa comprar.
        </p>
      ) : (
        <div className="space-y-2">
          {itensCotados.map((item) => (
            <ItemDaCotacao
              key={item.id}
              item={item}
              cotacaoId={cotacaoId}
              fornecedores={fornecedores}
              extras={extras[item.id] ?? []}
              aoCotarOutro={(fornecedorId) =>
                setExtras((atuais) => ({
                  ...atuais,
                  [item.id]: [...(atuais[item.id] ?? []), fornecedorId],
                }))
              }
              aberto={abertos[item.id] ?? true}
              aoAlternar={() =>
                setAbertos((atuais) => ({ ...atuais, [item.id]: !(atuais[item.id] ?? true) }))
              }
              editavel={editavel}
              pendente={pendente}
              agir={agir}
            />
          ))}
        </div>
      )}

      {itensCotados.length > 0 && (
        <div className="space-y-3 rounded-xl border border-borda bg-superficie px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {semEscolha > 0 ? (
              <Selo tom="alerta">
                {semEscolha} {semEscolha === 1 ? "item sem" : "itens sem"} fornecedor escolhido
              </Selo>
            ) : (
              <Selo tom="ok">Todos os itens têm fornecedor escolhido</Selo>
            )}
            <p className="text-sm">
              <span className="text-texto-fraco">Total da compra: </span>
              <span className="num text-lg font-bold text-texto">{moeda(totalGeral)}</span>
            </p>
          </div>

          {/* O que cada fornecedor leva. Era o rodape da tabela antiga, e
              continua sendo o que decide em quantos pedidos isso vai virar. */}
          {totaisEscolhidos.size > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-borda pt-3 text-xs">
              {fornecedores
                .filter((f) => totaisEscolhidos.has(f.id))
                .map((f) => (
                  <span key={f.id} className="text-texto-suave">
                    {f.nome}{" "}
                    <span className="num font-semibold text-texto">
                      {moeda(totaisEscolhidos.get(f.id)!)}
                    </span>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** Um item da cotação com os fornecedores dele embaixo. */
function ItemDaCotacao({
  item,
  cotacaoId,
  fornecedores,
  extras,
  aoCotarOutro,
  aberto,
  aoAlternar,
  editavel,
  pendente,
  agir,
}: {
  item: ItemCotado;
  cotacaoId: string;
  fornecedores: { id: string; nome: string }[];
  extras: string[];
  aoCotarOutro: (fornecedorId: string) => void;
  aberto: boolean;
  aoAlternar: () => void;
  editavel: boolean;
  pendente: boolean;
  agir: Agir;
}) {
  /* Do cadastro, mais quem ja tem preco aqui, mais quem foi acrescentado
     agora. Quem tem preco entra mesmo tendo sido desvinculado do item depois
     — senao o preco lancado sumiria da tela sem forma de mexer nele. */
  const colunas = useMemo(() => {
    const ids = new Set([
      ...item.fornecedoresDoItem.map((f) => f.id),
      ...item.precos.map((p) => p.fornecedorId),
      ...extras,
    ]);
    return fornecedores.filter((f) => ids.has(f.id));
  }, [item.fornecedoresDoItem, item.precos, extras, fornecedores]);

  const restantes = fornecedores.filter((f) => !colunas.some((c) => c.id === f.id));

  const validos = item.precos.filter((p) => p.precoUnitario > 0);
  const menor = validos.length ? Math.min(...validos.map((p) => p.precoUnitario)) : null;

  const escolhido = item.precos.find((p) => p.escolhido);
  const nomeEscolhido = fornecedores.find((f) => f.id === escolhido?.fornecedorId)?.nome;

  return (
    <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
      <div className="flex items-center gap-2 px-2 py-2 sm:px-3">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberto}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-superficie-2"
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-texto-fraco transition-transform",
              aberto && "rotate-90",
            )}
          />
          <span className="codigo shrink-0 text-xs font-semibold text-marca">{item.codigo}</span>
          <span className="min-w-0 truncate text-xs text-texto-fraco">{item.descricao}</span>
        </button>

        {/* Fechado, o resumo é a única leitura que sobra do item. */}
        {!aberto && (
          <span className="hidden shrink-0 text-xs sm:block">
            {escolhido ? (
              <>
                <span className="text-texto-suave">{nomeEscolhido}</span>{" "}
                <span className="num font-semibold text-texto">
                  {moeda(escolhido.precoUnitario * item.quantidade)}
                </span>
              </>
            ) : (
              <span className="text-texto-fraco">
                {validos.length > 0
                  ? `${validos.length} ${validos.length === 1 ? "preço" : "preços"} · sem escolha`
                  : "sem preço lançado"}
              </span>
            )}
          </span>
        )}

        <span className="flex shrink-0 items-center gap-1.5">
          {editavel ? (
            <QuantidadeCotada item={item} cotacaoId={cotacaoId} agir={agir} />
          ) : (
            <span className="num text-xs">{numero(item.quantidade)}</span>
          )}
          <span className="text-[10px] text-texto-fraco">{item.unidade}</span>
        </span>

        {editavel && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            disabled={pendente}
            onClick={() => agir(() => removerItemDaCotacao(item.id, cotacaoId))}
            title="Tirar item da cotação"
          >
            <Trash2 className="size-3.5 text-perigo" />
          </Botao>
        )}
      </div>

      {aberto && (
        <div className="border-t border-borda">
          {colunas.length === 0 ? (
            <p className="px-3 py-4 text-xs text-texto-fraco">
              Este item não tem fornecedor no cadastro.{" "}
              <Link
                href={`/itens/${item.itemId}`}
                className="font-semibold text-marca hover:underline"
              >
                Vincule um no cadastro do item
              </Link>{" "}
              ou escolha um abaixo.
            </p>
          ) : (
            <RolagemTabela>
              <table className="w-full border-collapse text-sm">
                <thead className="bg-superficie-2">
                  <tr>
                    {colunas.map((f) => (
                      <th
                        key={f.id}
                        className="min-w-36 border-b border-l border-borda px-3 py-2 text-left text-xs font-semibold text-texto-suave first:border-l-0"
                      >
                        {f.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {colunas.map((f) => {
                      const preco = item.precos.find((p) => p.fornecedorId === f.id);
                      const eMenor =
                        preco != null &&
                        menor != null &&
                        preco.precoUnitario === menor &&
                        menor > 0;

                      return (
                        <Celula
                          key={f.id}
                          cotacaoId={cotacaoId}
                          cotacaoItemId={item.id}
                          fornecedorId={f.id}
                          preco={preco}
                          quantidade={item.quantidade}
                          eMenor={eMenor}
                          editavel={editavel}
                          pendente={pendente}
                          agir={agir}
                        />
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </RolagemTabela>
          )}

          {editavel && restantes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-borda px-3 py-2">
              <Selecao
                value=""
                onChange={(e) => e.target.value && aoCotarOutro(e.target.value)}
                className="h-8 w-auto min-w-56 text-xs"
                aria-label={`Cotar outro fornecedor para ${item.codigo}`}
              >
                <option value="">+ Cotar outro fornecedor para este item...</option>
                {restantes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Selecao>
              <Link
                href={`/itens/${item.itemId}`}
                className="text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
              >
                Abrir cadastro do item
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Uma célula do comparativo: preço digitável, total e o botão de escolher. */
function Celula({
  cotacaoId,
  cotacaoItemId,
  fornecedorId,
  preco,
  quantidade,
  eMenor,
  editavel,
  pendente,
  agir,
}: {
  cotacaoId: string;
  cotacaoItemId: string;
  fornecedorId: string;
  preco?: PrecoCotado;
  quantidade: number;
  eMenor: boolean;
  editavel: boolean;
  pendente: boolean;
  agir: Agir;
}) {
  const total = (preco?.precoUnitario ?? 0) * quantidade;

  /* Enquanto ninguem digita, o campo mostra o que veio do servidor; assim o
     refresh depois de salvar chega sozinho na tela, sem efeito para
     ressincronizar. */
  const [rascunho, setRascunho] = useState<string | null>(null);

  function salvar(valor: string) {
    const p = paraNumero(valor);
    if (p === (preco?.precoUnitario ?? 0)) return;
    agir(() =>
      salvarPrecoCotado({
        cotacaoId,
        cotacaoItemId,
        fornecedorId,
        precoUnitario: p,
        prazoValor: preco?.prazoValor ?? 0,
        prazoUnidade: preco?.prazoUnidade ?? "dias",
        frete: preco?.frete ?? 0,
      }),
    );
  }

  return (
    <td
      className={cn(
        "border-l border-borda px-2 py-2 align-top first:border-l-0",
        preco?.escolhido && "bg-marca-suave/60",
        !preco?.escolhido && eMenor && "bg-ok-suave/40",
      )}
    >
      {editavel ? (
        <CampoMoeda
          valor={rascunho ?? (preco?.precoUnitario ? String(preco.precoUnitario) : "")}
          aoMudar={setRascunho}
          onBlur={() => {
            if (rascunho !== null) salvar(rascunho);
            setRascunho(null);
          }}
          placeholder="—"
          className="h-8 text-xs"
          aria-label="Preço unitário"
        />
      ) : (
        <p className="num py-1 text-right text-xs">
          {preco?.precoUnitario ? moeda(preco.precoUnitario) : "—"}
        </p>
      )}

      {preco && preco.precoUnitario > 0 && (
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="num text-[10px] text-texto-fraco">{moeda(total)}</span>

          {editavel && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={pendente}
                onClick={() =>
                  agir(() =>
                    escolherFornecedor(
                      cotacaoId,
                      cotacaoItemId,
                      preco.escolhido ? null : preco.id,
                    ),
                  )
                }
                title={preco.escolhido ? "Desmarcar" : "Escolher este fornecedor"}
                className={cn(
                  "grid size-5 place-items-center rounded-full border transition-colors",
                  preco.escolhido
                    ? "border-marca bg-marca text-marca-texto"
                    : "border-borda-forte text-transparent hover:border-marca hover:text-marca",
                )}
              >
                <Check className="size-3" />
              </button>
              <button
                type="button"
                disabled={pendente}
                onClick={() => agir(() => removerPrecoCotado(cotacaoId, preco.id))}
                title="Limpar este preço"
                className="grid size-5 place-items-center rounded text-texto-fraco transition-colors hover:text-perigo"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          {!editavel && preco.escolhido && <Selo tom="marca">escolhido</Selo>}
        </div>
      )}

      {eMenor && !preco?.escolhido && (
        <span className="mt-0.5 block text-[10px] font-semibold text-ok">menor preço</span>
      )}
    </td>
  );
}

/**
 * Quantidade da linha cotada. Salva ao sair do campo — a cotacao e planilha,
 * e parar para clicar em salvar a cada celula atrapalharia quem digita a
 * coluna inteira de uma vez.
 */
function QuantidadeCotada({
  item,
  cotacaoId,
  agir,
}: {
  item: ItemCotado;
  cotacaoId: string;
  agir: Agir;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);

  return (
    <CampoNumero
      valor={rascunho ?? String(item.quantidade)}
      aoMudar={setRascunho}
      onBlur={() => {
        const q = paraNumero(rascunho ?? "");
        if (q > 0 && q !== item.quantidade) {
          agir(() => atualizarQuantidadeCotacao(item.id, cotacaoId, q));
        }
        setRascunho(null);
      }}
      className="h-8 w-20 text-right text-xs"
      aria-label={`Quantidade de ${item.codigo}`}
    />
  );
}
