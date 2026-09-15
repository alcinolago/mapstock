"use client";

import { Ban, PackageCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Entrada } from "@/components/ui/campo";
import { Selo } from "@/components/ui/selo";
import {
  Cabecalho,
  Celula,
  Coluna,
  Corpo,
  Linha,
  RolagemTabela,
  Tabela,
} from "@/components/ui/tabela";
import { cancelarPedido, receberItemDoPedido } from "@/lib/acoes/compras";
import { moeda, numero, paraNumero } from "@/lib/utils";

export type LinhaPedido = {
  id: string;
  itemId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  recebida: number;
  precoUnitario: number;
};

export function Recebimento({
  pedidoId,
  linhas,
  frete,
  podeEditar,
  encerrado,
}: {
  pedidoId: string;
  linhas: LinhaPedido[];
  frete: number;
  podeEditar: boolean;
  encerrado: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});

  const subtotal = linhas.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0);

  function receber(linha: LinhaPedido) {
    const falta = linha.quantidade - linha.recebida;
    const q = paraNumero(quantidades[linha.id] ?? String(falta), falta);
    iniciar(async () => {
      const r = await receberItemDoPedido(linha.id, q);
      if (r.erro) alert(r.erro);
      else {
        setQuantidades((s) => ({ ...s, [linha.id]: "" }));
        router.refresh();
      }
    });
  }

  function cancelar() {
    if (!confirm("Cancelar este pedido?")) return;
    iniciar(async () => {
      const r = await cancelarPedido(pedidoId);
      if (r.erro) alert(r.erro);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Item</Coluna>
                <Coluna className="text-right">Pedido</Coluna>
                <Coluna className="text-right">Recebido</Coluna>
                <Coluna className="text-right">Preço un.</Coluna>
                <Coluna className="text-right">Total</Coluna>
                {podeEditar && !encerrado && <Coluna className="text-right">Receber</Coluna>}
              </tr>
            </Cabecalho>
            <Corpo>
              {linhas.map((l) => {
                const falta = l.quantidade - l.recebida;
                const completo = falta <= 0;

                return (
                  <Linha key={l.id}>
                    <Celula>
                      <Link
                        href={`/itens/${l.itemId}`}
                        className="codigo block text-xs font-semibold text-marca hover:underline"
                      >
                        {l.codigo}
                      </Link>
                      <span className="block max-w-72 truncate text-xs text-texto-fraco">
                        {l.descricao}
                      </span>
                    </Celula>
                    <Celula className="num text-right whitespace-nowrap">
                      {numero(l.quantidade)} <span className="text-texto-fraco">{l.unidade}</span>
                    </Celula>
                    <Celula className="num text-right">
                      {completo ? (
                        <Selo tom="ok">completo</Selo>
                      ) : (
                        <span className={l.recebida > 0 ? "text-alerta" : "text-texto-fraco"}>
                          {numero(l.recebida)} / faltam {numero(falta)}
                        </span>
                      )}
                    </Celula>
                    <Celula className="num text-right whitespace-nowrap text-texto-suave">
                      {moeda(l.precoUnitario)}
                    </Celula>
                    <Celula className="num text-right font-semibold whitespace-nowrap">
                      {moeda(l.quantidade * l.precoUnitario)}
                    </Celula>
                    {podeEditar && !encerrado && (
                      <Celula className="text-right">
                        {!completo && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Entrada
                              value={quantidades[l.id] ?? ""}
                              onChange={(e) =>
                                setQuantidades((s) => ({ ...s, [l.id]: e.target.value }))
                              }
                              placeholder={String(falta)}
                              inputMode="decimal"
                              className="num h-8 w-20 text-right text-xs"
                              aria-label={`Quantidade recebida de ${l.codigo}`}
                            />
                            <Botao
                              variante="salvar"
                              tamanho="sm"
                              disabled={pendente}
                              onClick={() => receber(l)}
                            >
                              <PackageCheck className="size-3.5" />
                              Receber
                            </Botao>
                          </div>
                        )}
                      </Celula>
                    )}
                  </Linha>
                );
              })}
            </Corpo>
          </Tabela>
        </RolagemTabela>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-4 py-3">
        {podeEditar && !encerrado ? (
          <Botao
            variante="fantasma"
            onClick={cancelar}
            disabled={pendente}
            className="text-perigo hover:bg-perigo-suave hover:text-perigo"
          >
            <Ban className="size-4" />
            Cancelar pedido
          </Botao>
        ) : (
          <span />
        )}

        <div className="text-right text-sm">
          <p className="text-texto-fraco">
            Itens {moeda(subtotal)}
            {frete > 0 && ` · frete ${moeda(frete)}`}
          </p>
          <p className="num text-lg font-bold text-texto">{moeda(subtotal + frete)}</p>
        </div>
      </div>
    </div>
  );
}
