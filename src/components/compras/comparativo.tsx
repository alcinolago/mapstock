"use client";

import { Check, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { SeletorItem, type ItemBusca } from "@/components/estoque/seletor-item";
import { Botao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campo";
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
};

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
  const [colunaExtra, setColunaExtra] = useState("");

  /* Colunas do comparativo: todo fornecedor que ja tem algum preco lancado,
     mais o que a pessoa acabou de acrescentar a mao. */
  const colunas = useMemo(() => {
    const ids = new Set(itensCotados.flatMap((i) => i.precos.map((p) => p.fornecedorId)));
    if (colunaExtra) ids.add(colunaExtra);
    return fornecedores.filter((f) => ids.has(f.id));
  }, [itensCotados, fornecedores, colunaExtra]);

  const semColuna = fornecedores.filter((f) => !colunas.some((c) => c.id === f.id));

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
          <Entrada
            value={novaQtd}
            onChange={(e) => setNovaQtd(e.target.value)}
            inputMode="decimal"
            className="num w-24"
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

          {semColuna.length > 0 && (
            <Selecao
              value=""
              onChange={(e) => setColunaExtra(e.target.value)}
              className="w-auto min-w-48"
              aria-label="Adicionar coluna de fornecedor"
            >
              <option value="">+ Cotar outro fornecedor...</option>
              {semColuna.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Selecao>
          )}
        </div>
      )}

      {itensCotados.length === 0 ? (
        <p className="rounded-xl border border-borda bg-superficie px-4 py-14 text-center text-sm text-texto-fraco">
          Nenhum item nesta cotação ainda. Adicione acima o que você precisa comprar.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
          <RolagemTabela>
            <table className="w-full border-collapse text-sm">
              <thead className="bg-superficie-2">
                <tr>
                  <th className="sticky left-0 z-10 min-w-56 border-b border-borda bg-superficie-2 px-3 py-2.5 text-left text-xs font-semibold text-texto-suave">
                    Item
                  </th>
                  <th className="border-b border-borda px-3 py-2.5 text-right text-xs font-semibold text-texto-suave">
                    Qtd.
                  </th>
                  {colunas.map((f) => (
                    <th
                      key={f.id}
                      className="min-w-36 border-b border-l border-borda px-3 py-2.5 text-left text-xs font-semibold text-texto-suave"
                    >
                      {f.nome}
                      {totaisEscolhidos.has(f.id) && (
                        <span className="num mt-0.5 block font-bold text-marca">
                          {moeda(totaisEscolhidos.get(f.id)!)}
                        </span>
                      )}
                    </th>
                  ))}
                  {editavel && <th className="border-b border-borda" />}
                </tr>
              </thead>

              <tbody className="divide-y divide-borda">
                {itensCotados.map((item) => {
                  const validos = item.precos.filter((p) => p.precoUnitario > 0);
                  const menor = validos.length
                    ? Math.min(...validos.map((p) => p.precoUnitario))
                    : null;

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-superficie-2/60">
                      <td className="sticky left-0 z-10 bg-superficie px-3 py-2.5">
                        <Link
                          href={`/itens/${item.itemId}`}
                          className="codigo block text-xs font-semibold text-marca hover:underline"
                        >
                          {item.codigo}
                        </Link>
                        <span className="block max-w-56 truncate text-xs text-texto-fraco">
                          {item.descricao}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        {editavel ? (
                          <Entrada
                            defaultValue={String(item.quantidade)}
                            inputMode="decimal"
                            onBlur={(e) => {
                              const q = paraNumero(e.target.value);
                              if (q > 0 && q !== item.quantidade) {
                                agir(() => atualizarQuantidadeCotacao(item.id, cotacaoId, q));
                              }
                            }}
                            className="num h-8 w-20 text-right text-xs"
                            aria-label={`Quantidade de ${item.codigo}`}
                          />
                        ) : (
                          <span className="num text-xs">{numero(item.quantidade)}</span>
                        )}
                        <span className="mt-0.5 block text-[10px] text-texto-fraco">
                          {item.unidade}
                        </span>
                      </td>

                      {colunas.map((f) => {
                        const preco = item.precos.find((p) => p.fornecedorId === f.id);
                        const eMenor =
                          preco != null && menor != null && preco.precoUnitario === menor && menor > 0;

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

                      {editavel && (
                        <td className="px-2 text-right">
                          <Botao
                            variante="fantasma"
                            tamanho="sm"
                            disabled={pendente}
                            onClick={() =>
                              agir(() => removerItemDaCotacao(item.id, cotacaoId))
                            }
                            title="Tirar item da cotação"
                          >
                            <Trash2 className="size-3.5 text-perigo" />
                          </Botao>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-superficie-2 font-semibold">
                  <td className="sticky left-0 z-10 bg-superficie-2 px-3 py-3 text-xs">
                    Total escolhido
                  </td>
                  <td />
                  {colunas.map((f) => (
                    <td key={f.id} className="num border-l border-borda px-3 py-3 text-xs">
                      {totaisEscolhidos.has(f.id) ? moeda(totaisEscolhidos.get(f.id)!) : "—"}
                    </td>
                  ))}
                  {editavel && <td />}
                </tr>
              </tfoot>
            </table>
          </RolagemTabela>
        </div>
      )}

      {itensCotados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            {semEscolha > 0 ? (
              <Selo tom="alerta">
                {semEscolha} {semEscolha === 1 ? "item sem" : "itens sem"} fornecedor escolhido
              </Selo>
            ) : (
              <Selo tom="ok">Todos os itens têm fornecedor escolhido</Selo>
            )}
          </div>
          <p className="text-sm">
            <span className="text-texto-fraco">Total da compra: </span>
            <span className="num text-lg font-bold text-texto">{moeda(totalGeral)}</span>
          </p>
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
  agir: (fn: () => Promise<unknown>) => void;
}) {
  const total = (preco?.precoUnitario ?? 0) * quantidade;

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
        "border-l border-borda px-2 py-2 align-top",
        preco?.escolhido && "bg-marca-suave/60",
        !preco?.escolhido && eMenor && "bg-ok-suave/40",
      )}
    >
      {editavel ? (
        <Entrada
          defaultValue={preco ? String(preco.precoUnitario) : ""}
          onBlur={(e) => salvar(e.target.value)}
          inputMode="decimal"
          placeholder="—"
          className="num h-8 text-right text-xs"
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
