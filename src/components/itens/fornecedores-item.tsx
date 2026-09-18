"use client";

import { Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { NovoFornecedor } from "./novo-fornecedor";
import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CampoMoeda, CampoNumero } from "@/components/ui/campo-mascarado";
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
  /* Os criados pela janela entram aqui, e nao por recarga da pagina: quem
     esta no meio do cadastro de um item nao pode perder o que digitou so
     porque cadastrou um fornecedor. */
  const [novos, setNovos] = useState<{ id: string; nome: string }[]>([]);
  const lista = [...fornecedores, ...novos];

  function acolher(f: { id: string; nome: string }, indice?: number) {
    setNovos((atuais) => [...atuais, f]);
    if (indice === undefined) {
      aoMudar([
        ...vinculos,
        { ...VINCULO_VAZIO, fornecedorId: f.id, principal: vinculos.length === 0 },
      ]);
    } else {
      atualizar(indice, { fornecedorId: f.id });
    }
  }

  function atualizar(indice: number, mudanca: Partial<VinculoFornecedor>) {
    aoMudar(vinculos.map((v, i) => (i === indice ? { ...v, ...mudanca } : v)));
  }

  function definirPrincipal(indice: number) {
    aoMudar(vinculos.map((v, i) => ({ ...v, principal: i === indice })));
  }

  if (lista.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-superficie-2 px-4 py-6 text-center">
        <p className="text-sm text-texto-fraco">
          Nenhum fornecedor cadastrado ainda. Cadastre o primeiro aqui mesmo — o item
          continua como está.
        </p>
        <NovoFornecedor aoCriar={(f) => acolher(f)} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Escolher vem antes de cadastrar. Sem este bloco, a aba abria com um
          botão só — "Adicionar fornecedor" — e a lista dos que já existem
          ficava escondida atrás dele, como se o único caminho fosse criar
          um novo. */}
      {vinculos.length === 0 && (
        <div className="rounded-xl border border-dashed border-borda-forte bg-superficie-2 p-4">
          <p className="mb-3 text-sm text-texto-fraco">
            Nenhum fornecedor vinculado a este item ainda. Escolha um dos{" "}
            {lista.length} já cadastrados:
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Grupo rotulo="Fornecedor" className="min-w-56 flex-1">
              <Selecao
                value=""
                onChange={(e) =>
                  e.target.value &&
                  aoMudar([
                    { ...VINCULO_VAZIO, fornecedorId: e.target.value, principal: true },
                  ])
                }
              >
                <option value="">Selecione...</option>
                {lista.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Selecao>
            </Grupo>

            <div className="flex items-center gap-3 pb-0.5">
              <span className="text-xs text-texto-fraco">ou</span>
              <NovoFornecedor aoCriar={(f) => acolher(f)} compacto />
            </div>
          </div>
        </div>
      )}

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
              <Grupo
                rotulo="Fornecedor"
                obrigatorio
                className="lg:col-span-2"
                ajuda={
                  v.fornecedorId ? undefined : (
                    <NovoFornecedor aoCriar={(f) => acolher(f, i)} compacto />
                  )
                }
              >
                <Selecao
                  value={v.fornecedorId}
                  onChange={(e) => atualizar(i, { fornecedorId: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {lista.map((f) => (
                    <option key={f.id} value={f.id} disabled={jaUsados.includes(f.id)}>
                      {f.nome}
                      {jaUsados.includes(f.id) ? " (já vinculado)" : ""}
                    </option>
                  ))}
                </Selecao>
              </Grupo>

              <Grupo rotulo="Preço (R$)">
                <CampoMoeda
                  valor={v.preco}
                  aoMudar={(preco) => atualizar(i, { preco })}
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
                  <CampoNumero
                    valor={v.prazoValor}
                    aoMudar={(prazoValor) => atualizar(i, { prazoValor })}
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
                <CampoNumero
                  valor={v.qtdMinima}
                  aoMudar={(qtdMinima) => atualizar(i, { qtdMinima })}
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

      {/* Só com o primeiro vínculo já feito. Antes disso quem convida é o
          bloco de cima, e dois botões dizendo a mesma coisa na mesma tela
          era escolha demais para uma decisão que não tem escolha nenhuma. */}
      {vinculos.length > 0 && (
        <Botao
          type="button"
          variante="contorno"
          onClick={() => aoMudar([...vinculos, { ...VINCULO_VAZIO, principal: false }])}
          disabled={vinculos.length >= lista.length}
        >
          <Plus className="size-4" />
          Adicionar fornecedor
        </Botao>
      )}
    </div>
  );
}
