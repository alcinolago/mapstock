"use client";

import { AlertCircle, LoaderCircle, Plus } from "lucide-react";
import { useActionState, useState } from "react";

import { SeletorItem, type ItemBusca } from "@/components/estoque/seletor-item";
import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CampoNumero } from "@/components/ui/campo-mascarado";
import { CabecalhoCartao, Cartao, CorpoCartao } from "@/components/ui/cartao";
import { vincularNaEstrutura, type EstadoEstrutura } from "@/lib/acoes/estrutura";

export function FormularioVinculo({ itens }: { itens: ItemBusca[] }) {
  const [estado, acao, enviando] = useActionState<EstadoEstrutura, FormData>(
    vincularNaEstrutura,
    {},
  );
  const [paiId, setPaiId] = useState<string>();
  const [filhoId, setFilhoId] = useState<string>();
  const [chave, setChave] = useState(0);
  const [tratado, setTratado] = useState<EstadoEstrutura | null>(null);

  /* Mantem o pai escolhido e limpa so o filho: montar uma arvore e
     acrescentar varias pecas seguidas na mesma montagem. A arvore se
     atualiza sozinha — a action ja chama revalidatePath. */
  if (estado.ok && estado !== tratado) {
    setTratado(estado);
    setFilhoId(undefined);
    setChave((k) => k + 1);
  }

  return (
    <Cartao>
      <CabecalhoCartao
        titulo="Adicionar componente"
        descricao="Monte a árvore ligando cada peça à montagem que a contém."
      />
      <CorpoCartao>
        <form action={acao} key={chave} className="space-y-4">
          <Grupo rotulo="Montagem (pai)" obrigatorio>
            <SeletorItem itens={itens} valor={paiId} aoEscolher={setPaiId} nome="paiId" />
          </Grupo>

          <Grupo rotulo="Componente (filho)" obrigatorio>
            <SeletorItem
              itens={itens.filter((i) => i.id !== paiId)}
              valor={filhoId}
              aoEscolher={setFilhoId}
              nome="filhoId"
            />
          </Grupo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Grupo rotulo="Quantidade" obrigatorio htmlFor="quantidade">
              <CampoNumero id="quantidade" name="quantidade" padrao="1" required />
            </Grupo>

            <Grupo rotulo="Obrigatório" htmlFor="obrigatorio">
              <Selecao id="obrigatorio" name="obrigatorio" defaultValue="true">
                <option value="true">Sim</option>
                <option value="false">Opcional</option>
              </Selecao>
            </Grupo>
          </div>

          <Grupo rotulo="Local de montagem" htmlFor="localMontagem">
            <Entrada
              id="localMontagem"
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

          <Botao
            type="submit"
            className="w-full"
            disabled={enviando || !paiId || !filhoId}
          >
            {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {enviando ? "Vinculando..." : "Adicionar à estrutura"}
          </Botao>
        </form>
      </CorpoCartao>
    </Cartao>
  );
}
