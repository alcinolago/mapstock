"use client";

import { Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";

import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { cn } from "@/lib/utils";

export type VinculoFornecedor = {
  fornecedorId: string;
  skuFornecedor: string;
  linkItem: string;
  preco: string;
  prazoValor: string;
  prazoUnidade: "horas" | "dias";
  qtdMinima: string;
  observacoes: string;
  principal: boolean;
};

export const VINCULO_VAZIO: VinculoFornecedor = {
  fornecedorId: "",
  skuFornecedor: "",
  linkItem: "",
  preco: "",
  prazoValor: "",
  prazoUnidade: "dias",
  qtdMinima: "",
  observacoes: "",
  principal: false,
};

/**
 * Um item pode ter varios fornecedores, e e exatamente essa lista que a
 * cotacao de compra usa depois para montar o comparativo de precos.
 *
 * Diferenca em relacao ao desktop: la cada fornecedor era redigitado inteiro
 * (nome, telefone, e-mail, site...) dentro do item. Aqui o fornecedor tem
 * cadastro proprio e aqui so entra o que muda de item para item: preco, SKU,
 * prazo e quantidade minima.
 */
export function FornecedoresItem({
  fornecedores,
  vinculos,
  aoMudar,
}: {
  fornecedores: { id: string; nome: string }[];
  vinculos: VinculoFornecedor[];
  aoMudar: (v: VinculoFornecedor[]) => void;
}) {
  function atualizar(indice: number, mudanca: Partial<VinculoFornecedor>) {
    aoMudar(vinculos.map((v, i) => (i === indice ? { ...v, ...mudanca } : v)));
  }

  function definirPrincipal(indice: number) {
    aoMudar(vinculos.map((v, i) => ({ ...v, principal: i === indice })));
  }

  if (fornecedores.length === 0) {
    return (
      <p className="rounded-lg bg-superficie-2 px-4 py-6 text-center text-sm text-texto-fraco">
        Nenhum fornecedor cadastrado ainda. Cadastre em{" "}
        <Link href="/fornecedores" className="font-semibold text-marca hover:underline">
          Fornecedores
        </Link>{" "}
        para poder vincular aqui.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {vinculos.map((v, i) => {
        const jaUsados = vinculos.filter((_, j) => j !== i).map((o) => o.fornecedorId);
        return (
          <div
            key={i}
            className={cn(
              "rounded-xl border p-4",
              v.principal ? "border-marca/50 bg-marca-suave/30" : "border-borda bg-superficie-2",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => definirPrincipal(i)}
                title="Marcar como fornecedor principal"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                  v.principal
                    ? "text-marca"
                    : "text-texto-fraco hover:bg-superficie hover:text-texto",
                )}
              >
                <Star className={cn("size-3.5", v.principal && "fill-current")} />
                {v.principal ? "Principal" : "Tornar principal"}
              </button>

              <Botao
                type="button"
                variante="fantasma"
                tamanho="sm"
                onClick={() => aoMudar(vinculos.filter((_, j) => j !== i))}
                className="text-perigo hover:bg-perigo-suave hover:text-perigo"
              >
                <Trash2 className="size-3.5" />
                Remover
              </Botao>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Grupo rotulo="Fornecedor" obrigatorio className="lg:col-span-2">
                <Selecao
                  value={v.fornecedorId}
                  onChange={(e) => atualizar(i, { fornecedorId: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id} disabled={jaUsados.includes(f.id)}>
                      {f.nome}
                      {jaUsados.includes(f.id) ? " (já vinculado)" : ""}
                    </option>
                  ))}
                </Selecao>
              </Grupo>

              <Grupo rotulo="Preço (R$)">
                <Entrada
                  inputMode="decimal"
                  value={v.preco}
                  onChange={(e) => atualizar(i, { preco: e.target.value })}
                  placeholder="0,00"
                />
              </Grupo>

              <Grupo rotulo="Código do fornecedor (SKU)">
                <Entrada
                  value={v.skuFornecedor}
                  onChange={(e) => atualizar(i, { skuFornecedor: e.target.value })}
                />
              </Grupo>

              <Grupo rotulo="Prazo de entrega">
                <div className="flex gap-2">
                  <Entrada
                    inputMode="decimal"
                    value={v.prazoValor}
                    onChange={(e) => atualizar(i, { prazoValor: e.target.value })}
                    placeholder="0"
                  />
                  <Selecao
                    value={v.prazoUnidade}
                    onChange={(e) =>
                      atualizar(i, { prazoUnidade: e.target.value as "horas" | "dias" })
                    }
                    className="w-28"
                    aria-label="Unidade do prazo"
                  >
                    <option value="dias">dias</option>
                    <option value="horas">horas</option>
                  </Selecao>
                </div>
              </Grupo>

              <Grupo rotulo="Quantidade mínima">
                <Entrada
                  inputMode="decimal"
                  value={v.qtdMinima}
                  onChange={(e) => atualizar(i, { qtdMinima: e.target.value })}
                  placeholder="0"
                />
              </Grupo>

              <Grupo rotulo="Link do item na loja" className="lg:col-span-2">
                <Entrada
                  type="url"
                  value={v.linkItem}
                  onChange={(e) => atualizar(i, { linkItem: e.target.value })}
                  placeholder="https://"
                />
              </Grupo>

              <Grupo rotulo="Observações">
                <Entrada
                  value={v.observacoes}
                  onChange={(e) => atualizar(i, { observacoes: e.target.value })}
                />
              </Grupo>
            </div>
          </div>
        );
      })}

      <Botao
        type="button"
        variante="contorno"
        onClick={() =>
          aoMudar([...vinculos, { ...VINCULO_VAZIO, principal: vinculos.length === 0 }])
        }
        disabled={vinculos.length >= fornecedores.length}
      >
        <Plus className="size-4" />
        Adicionar fornecedor
      </Botao>
    </div>
  );
}
