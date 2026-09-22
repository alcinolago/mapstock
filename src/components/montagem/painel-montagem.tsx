"use client";

import { AlertCircle, ChevronRight, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Grupo, Selecao } from "@/components/ui/campo";
import { CabecalhoCartao, Cartao } from "@/components/ui/cartao";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Modal } from "@/components/ui/modal";
import { Selo } from "@/components/ui/selo";
import { ArvoreMontagem, type NoMontagem } from "./arvore-montagem";
import { MontarMontagem } from "./montar";
import { abrirMontagem, excluirMontagem } from "@/lib/acoes/montagem";
import { STATUS_MONTAGEM } from "@/lib/labels";
import { cn, data } from "@/lib/utils";
import type { TomSelo } from "@/components/ui/selo";

const TOM: Record<string, TomSelo> = {
  em_montagem: "alerta",
  montada: "ok",
};

export type MontagemNaTela = {
  id: string;
  numero: string;
  nome: string;
  item: string;
  status: string;
  local: string | null;
  observacoes: string | null;
  iniciadaEm: Date;
  montadaEm: Date | null;
  montadaPor: string | null;
  /** Quantas peças da árvore estão sem saldo suficiente agora. */
  faltando: number;
  nos: NoMontagem[];
};

export type OpcaoConjunto = { id: string; nome: string; item: string };

export function PainelMontagem({
  montagens,
  podeEditar,
  vazio,
}: {
  montagens: MontagemNaTela[];
  podeEditar: boolean;
  vazio: React.ReactNode;
}) {
  if (montagens.length === 0) {
    return (
      <Cartao>
        <p className="px-4 py-14 text-center text-sm text-texto-fraco">{vazio}</p>
      </Cartao>
    );
  }

  return (
    <div className="space-y-4">
      {montagens.map((m) => (
        <CartaoMontagem key={m.id} montagem={m} podeEditar={podeEditar} />
      ))}
    </div>
  );
}

/** Quantas peças a árvore inteira tem, para o botão dizer o que esconde. */
function contarPecas(nos: NoMontagem[]): number {
  return nos.reduce((t, n) => t + (n.itemId ? 1 : 0) + contarPecas(n.filhos), 0);
}

function CartaoMontagem({
  montagem: m,
  podeEditar,
}: {
  montagem: MontagemNaTela;
  podeEditar: boolean;
}) {
  const router = useRouter();
  /* Recolhida por padrão: com meia dúzia de unidades abertas, seis árvores
     inteiras empilhadas viram uma parede e some a informação que importa —
     qual delas dá para montar agora. */
  const [aberta, setAberta] = useState(false);

  const montada = m.status === "montada";
  const pecas = contarPecas(m.nos);

  return (
    <Cartao className="overflow-hidden">
      <CabecalhoCartao
        titulo={`${m.numero} — ${m.nome}`}
        descricao={`Produz ${m.item} · aberta em ${data(m.iniciadaEm)}${
          m.montadaEm ? ` · montada em ${data(m.montadaEm)}` : ""
        }${m.montadaPor ? ` por ${m.montadaPor}` : ""}${m.local ? ` · ${m.local}` : ""}`}
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <Selo tom={TOM[m.status] ?? "neutro"}>
              {STATUS_MONTAGEM[m.status as keyof typeof STATUS_MONTAGEM] ?? m.status}
            </Selo>

            {/* Enquanto aberta, o que interessa é se dá para montar agora.
                Cada montagem responde por si: o saldo é do momento do clique,
                e quem clicar primeiro leva as peças. */}
            {!montada &&
              (m.faltando > 0 ? (
                <Selo tom="perigo">
                  {m.faltando === 1 ? "falta 1 peça" : `faltam ${m.faltando} peças`}
                </Selo>
              ) : (
                <Selo tom="ok">tudo em estoque</Selo>
              ))}

            {podeEditar && !montada && <MontarMontagem montagemId={m.id} item={m.item} />}

            {podeEditar && !montada && (
              <BotaoConfirmar
                rotulo={`Excluir ${m.numero}`}
                Icone={Trash2}
                tamanho="sm"
                somenteIcone
                iconeClassName="size-3.5 text-perigo"
                dica="Excluir montagem"
                titulo="Excluir montagem"
                descricao={`${m.numero} — ${m.nome}`}
                rotuloConfirmar="Excluir"
                aoConfirmar={async () => {
                  const r = await excluirMontagem(m.id);
                  if (r.erro) return r;
                  router.refresh();
                }}
              >
                <p>Nada foi consumido ainda, então some sem deixar rastro no estoque.</p>
              </BotaoConfirmar>
            )}
          </div>
        }
      />

      {pecas > 0 && (
        <button
          type="button"
          onClick={() => setAberta((a) => !a)}
          aria-expanded={aberta}
          className="flex w-full items-center gap-1.5 border-t border-borda px-4 py-2 text-xs font-semibold text-texto-fraco transition-colors hover:bg-superficie-2 hover:text-texto"
        >
          <ChevronRight className={cn("size-3.5 transition-transform", aberta && "rotate-90")} />
          {aberta ? "Ocultar" : `Ver ${pecas} ${pecas === 1 ? "peça" : "peças"}`}
        </button>
      )}

      {aberta && <ArvoreMontagem nos={m.nos} montada={montada} />}
    </Cartao>
  );
}

/**
 * Abrir uma montagem é sempre uma unidade. Seis domos são seis montagens —
 * sem campo de quantidade, porque cada uma confere o estoque sozinha no
 * momento em que for montada.
 */
export function NovaMontagem({ conjuntos }: { conjuntos: OpcaoConjunto[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [moldeId, setMoldeId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    iniciar(async () => {
      const r = await abrirMontagem(moldeId);
      setErro(r.erro ?? null);
      if (!r.erro) {
        setAberto(false);
        setMoldeId("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)}>
        <Plus className="size-4" />
        Nova montagem
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Nova montagem"
        descricao="Uma unidade do item escolhido. Para montar duas, abra duas."
        centralizado
        rodape={
          <>
            <Botao variante="suave" onClick={() => setAberto(false)} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao onClick={confirmar} disabled={pendente || !moldeId}>
              {pendente ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Abrir
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Grupo rotulo="Item" obrigatorio htmlFor="nova-montagem-conjunto">
            {conjuntos.length === 0 ? (
              <p className="rounded-lg bg-superficie-2 px-3 py-2.5 text-sm text-texto-fraco">
                Nenhum item com estrutura montada. Crie um em Estrutura, na parte de baixo da
                tela, e coloque pelo menos uma peça dentro.
              </p>
            ) : (
              <Selecao
                id="nova-montagem-conjunto"
                value={moldeId}
                onChange={(e) => setMoldeId(e.target.value)}
              >
                <option value="">Escolha...</option>
                {conjuntos.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nome} — {k.item}
                  </option>
                ))}
              </Selecao>
            )}
          </Grupo>

          <p className="text-xs leading-relaxed text-texto-fraco">
            Abrir não mexe no estoque e não depende de ter peça: a árvore é uma cópia da
            estrutura, congelada agora. As peças só saem quando você clicar em Montar.
          </p>

          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2.5 text-sm font-medium text-perigo"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {erro}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
