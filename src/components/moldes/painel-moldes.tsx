"use client";

import { AlertCircle, LoaderCircle, Plus, Eye, EyeOff, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ItemBusca } from "@/components/estoque/seletor-item";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Grupo } from "@/components/ui/campo";
import { CabecalhoCartao, Cartao } from "@/components/ui/cartao";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Modal } from "@/components/ui/modal";
import { Selo } from "@/components/ui/selo";
import { AdicionarNo, type OpcaoDivisao } from "./adicionar-no";
import { ArvoreMolde, type NoMolde } from "./arvore-molde";
import { alternarMolde, excluirMolde, salvarMolde, type EstadoMolde } from "@/lib/acoes/moldes";
import { moeda } from "@/lib/utils";

export type MoldeNaTela = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  montagens: number;
  custoTotal: number;
  nos: NoMolde[];
};

/**
 * Os moldes, um cartao cada. Criar quantos quiser, a hora que quiser: aqui
 * e planejamento puro, e nao depende de ter peca nenhuma no estoque.
 */
export function PainelMoldes({
  moldes,
  divisoes,
  itens,
  podeEditar,
}: {
  moldes: MoldeNaTela[];
  divisoes: OpcaoDivisao[];
  itens: ItemBusca[];
  podeEditar: boolean;
}) {
  if (moldes.length === 0) {
    return (
      <Cartao>
        <p className="px-4 py-14 text-center text-sm text-texto-fraco">
          Nenhum equipamento ainda. Clique em{" "}
          <strong className="font-semibold text-texto-suave">Novo equipamento</strong> para criar
          o primeiro molde.
        </p>
      </Cartao>
    );
  }

  return (
    <div className="space-y-5">
      {moldes.map((m) => (
        <CartaoMolde
          key={m.id}
          molde={m}
          divisoes={divisoes}
          itens={itens}
          podeEditar={podeEditar}
        />
      ))}
    </div>
  );
}

function CartaoMolde({
  molde,
  divisoes,
  itens,
  podeEditar,
}: {
  molde: MoldeNaTela;
  divisoes: OpcaoDivisao[];
  itens: ItemBusca[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const pecas = contar(molde.nos);

  return (
    <Cartao className="overflow-hidden">
      <CabecalhoCartao
        titulo={molde.nome}
        descricao={
          molde.descricao ??
          `${pecas.divisoes} ${pecas.divisoes === 1 ? "divisão" : "divisões"} · ${pecas.pecas} ${pecas.pecas === 1 ? "peça" : "peças"}`
        }
        acao={
          <div className="flex items-center gap-2">
            {molde.custoTotal > 0 && (
              <Selo tom="neutro" title="Custo estimado de uma unidade">
                {moeda(molde.custoTotal)}
              </Selo>
            )}
            {!molde.ativo && <Selo tom="alerta">inativo</Selo>}
            {molde.montagens > 0 && (
              <Selo tom="marca">
                {molde.montagens} {molde.montagens === 1 ? "montagem" : "montagens"}
              </Selo>
            )}
            {podeEditar && (
              <>
                <AdicionarNo
                  moldeId={molde.id}
                  paiId={null}
                  paiNome={molde.nome}
                  divisoes={divisoes}
                  itens={itens}
                />
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  disabled={pendente}
                  title={molde.ativo ? "Desativar" : "Reativar"}
                  onClick={() =>
                    iniciar(async () => {
                      await alternarMolde(molde.id);
                      router.refresh();
                    })
                  }
                >
                  {molde.ativo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Botao>
                <BotaoConfirmar
                  rotulo={`Excluir ${molde.nome}`}
                  Icone={Trash2}
                  tamanho="sm"
                  somenteIcone
                  iconeClassName="size-3.5 text-perigo"
                  dica="Excluir molde"
                  titulo="Excluir molde"
                  descricao={molde.nome}
                  rotuloConfirmar="Excluir"
                  aoConfirmar={async () => {
                    const r = await excluirMolde(molde.id);
                    if (r.erro) return r;
                    router.refresh();
                  }}
                >
                  <p>
                    Sai o molde inteiro, com todas as divisões e peças dele. Nada disso mexe no
                    estoque. Montagens já abertas guardam a cópia delas e continuam como estão.
                  </p>
                </BotaoConfirmar>
              </>
            )}
          </div>
        }
      />
      <ArvoreMolde
        moldeId={molde.id}
        nos={molde.nos}
        divisoes={divisoes}
        itens={itens}
        podeEditar={podeEditar}
      />
    </Cartao>
  );
}

function contar(nos: NoMolde[]): { divisoes: number; pecas: number } {
  return nos.reduce(
    (total, no) => {
      const dentro = contar(no.filhos);
      return {
        divisoes: total.divisoes + (no.itemId ? 0 : 1) + dentro.divisoes,
        pecas: total.pecas + (no.itemId ? 1 : 0) + dentro.pecas,
      };
    },
    { divisoes: 0, pecas: 0 },
  );
}

export function NovoMolde() {
  const [aberto, setAberto] = useState(false);
  const [chave, setChave] = useState(0);
  const [tratado, setTratado] = useState<EstadoMolde | null>(null);
  const [estado, acao, enviando] = useActionState<EstadoMolde, FormData>(salvarMolde, {});

  if (estado.ok && estado !== tratado) {
    setTratado(estado);
    setAberto(false);
    setChave((k) => k + 1);
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)}>
        <Plus className="size-4" />
        Novo equipamento
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Novo equipamento"
        descricao="O molde é a receita: divisões e peças. Não mexe no estoque."
        centralizado
        rodape={
          <>
            <Botao variante="suave" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao type="submit" form="novo-molde" disabled={enviando}>
              {enviando ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Criar
            </Botao>
          </>
        }
      >
        <form id="novo-molde" action={acao} key={chave} className="space-y-4">
          <Grupo rotulo="Nome do equipamento" obrigatorio htmlFor="molde-nome">
            <Entrada
              id="molde-nome"
              name="nome"
              placeholder="Ex.: Equipamento de inspeção XYZ"
              required
              autoFocus
            />
          </Grupo>
          <Grupo rotulo="Descrição" htmlFor="molde-descricao">
            <AreaTexto
              id="molde-descricao"
              name="descricao"
              placeholder="O que é, para que serve, particularidades da montagem"
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
