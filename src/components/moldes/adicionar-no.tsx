"use client";

import { AlertCircle, LoaderCircle, Plus } from "lucide-react";
import { useActionState, useState } from "react";

import { SeletorItem, type ItemBusca } from "@/components/estoque/seletor-item";
import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CampoNumero } from "@/components/ui/campo-mascarado";
import { Modal } from "@/components/ui/modal";
import { adicionarNo, type EstadoNo } from "@/lib/acoes/moldes";

export type OpcaoDivisao = { id: string; nome: string };

/**
 * Acrescenta uma divisao ou uma peca dentro de um no do molde.
 *
 * As duas coisas moram na mesma janela porque, na cabeca de quem monta, o
 * gesto e um so: "o que mais entra aqui?". A escolha entre divisao e peca e
 * um par de abas, nao duas telas diferentes.
 */
export function AdicionarNo({
  moldeId,
  paiId,
  paiNome,
  divisoes,
  itens,
  compacto = false,
}: {
  moldeId: string;
  /** Nulo = direto na raiz do molde. */
  paiId: string | null;
  paiNome: string;
  divisoes: OpcaoDivisao[];
  itens: ItemBusca[];
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<"divisao" | "peca">("divisao");
  const [itemId, setItemId] = useState<string>();
  const [divisaoId, setDivisaoId] = useState("");
  const [chave, setChave] = useState(0);
  const [tratado, setTratado] = useState<EstadoNo | null>(null);
  const [estado, acao, enviando] = useActionState<EstadoNo, FormData>(adicionarNo, {});

  if (estado.ok && estado !== tratado) {
    setTratado(estado);
    setAberto(false);
    setItemId(undefined);
    setDivisaoId("");
    setChave((k) => k + 1);
  }

  const idFormulario = `no-${paiId ?? "raiz"}`;
  const escolhido = aba === "divisao" ? divisaoId : itemId;

  return (
    <>
      {compacto ? (
        <Botao
          variante="fantasma"
          tamanho="sm"
          onClick={() => setAberto(true)}
          title={`Adicionar dentro de ${paiNome}`}
          aria-label={`Adicionar dentro de ${paiNome}`}
          className="px-1.5"
        >
          <Plus className="size-3.5" />
        </Botao>
      ) : (
        <Botao variante="contorno" tamanho="sm" onClick={() => setAberto(true)}>
          <Plus className="size-4" />
          Adicionar
        </Botao>
      )}

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Adicionar à estrutura"
        descricao={`dentro de ${paiNome}`}
        centralizado
        rodape={
          <>
            <Botao variante="suave" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao type="submit" form={idFormulario} disabled={enviando || !escolhido}>
              {enviando ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {enviando ? "Salvando..." : "Adicionar"}
            </Botao>
          </>
        }
      >
        <form id={idFormulario} action={acao} key={chave} className="space-y-4">
          <input type="hidden" name="moldeId" value={moldeId} />
          <input type="hidden" name="paiId" value={paiId ?? ""} />
          <input type="hidden" name="divisaoId" value={aba === "divisao" ? divisaoId : ""} />
          <input type="hidden" name="itemId" value={aba === "peca" ? (itemId ?? "") : ""} />

          <div className="flex gap-1 rounded-lg bg-superficie-2 p-1">
            {(["divisao", "peca"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAba(v)}
                className={
                  aba === v
                    ? "flex-1 rounded-md bg-superficie px-3 py-1.5 text-sm font-semibold text-texto shadow-sm"
                    : "flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-texto-fraco hover:text-texto"
                }
              >
                {v === "divisao" ? "Divisão" : "Peça do estoque"}
              </button>
            ))}
          </div>

          {aba === "divisao" ? (
            <Grupo
              rotulo="Divisão"
              obrigatorio
              htmlFor={`${idFormulario}-div`}
              ajuda="Agrupador. Não é item e nunca entra no estoque — cadastre novos nomes na tela Divisões."
            >
              <Selecao
                id={`${idFormulario}-div`}
                value={divisaoId}
                onChange={(e) => setDivisaoId(e.target.value)}
              >
                <option value="">Escolha...</option>
                {divisoes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </Selecao>
            </Grupo>
          ) : (
            <Grupo
              rotulo="Peça"
              obrigatorio
              ajuda="Sai do estoque na hora de montar, nunca antes."
            >
              <SeletorItem
                itens={itens}
                valor={itemId}
                aoEscolher={setItemId}
                nome="itemIdVisual"
                placeholder="Buscar item por código ou descrição..."
              />
            </Grupo>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Grupo rotulo="Quantidade" obrigatorio htmlFor={`${idFormulario}-qtd`}>
              <CampoNumero id={`${idFormulario}-qtd`} name="quantidade" padrao="1" required />
            </Grupo>
            <Grupo rotulo="Obrigatório" htmlFor={`${idFormulario}-obr`}>
              <Selecao id={`${idFormulario}-obr`} name="obrigatorio" defaultValue="true">
                <option value="true">Sim</option>
                <option value="false">Opcional</option>
              </Selecao>
            </Grupo>
          </div>

          <Grupo rotulo="Local de montagem" htmlFor={`${idFormulario}-local`}>
            <Entrada
              id={`${idFormulario}-local`}
              name="localMontagem"
              placeholder="Ex.: face traseira, painel elétrico"
            />
          </Grupo>

          {estado.erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2.5 text-sm font-medium text-perigo"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {estado.erro}
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
