"use client";

import { AlertTriangle, Check, Hammer, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { Selo } from "@/components/ui/selo";
import { conferirMontagem, montarMontagem, type FaltaNaMontagem } from "@/lib/acoes/montagem";
import { numero } from "@/lib/utils";

/**
 * Montar: um clique só, a árvore inteira.
 *
 * A janela existe porque montar não é mudar um campo — as peças saem do
 * estoque e o item pronto entra. Antes de confirmar, quem está na bancada vê
 * exatamente o que vai ser consumido e o que falta, que foi o pedido de quem
 * não quer descobrir na hora que faltou parafuso.
 *
 * O botão fica visível mesmo faltando peça, e desabilitado dentro da janela:
 * sumir esconderia o porquê, e o porquê é justamente o que interessa.
 */
export function MontarMontagem({
  montagemId,
  item,
}: {
  montagemId: string;
  /** O que sai pronto, para a janela dizer o que vai entrar no estoque. */
  item: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [pecas, setPecas] = useState<FaltaNaMontagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setAberto(true);
    setErro(null);
    setCarregando(true);
    const r = await conferirMontagem(montagemId);
    setPecas(r.pecas);
    setCarregando(false);
  }

  const faltando = pecas.filter((p) => p.disponivel < p.necessario);
  const podeMontar = pecas.length > 0 && faltando.length === 0;

  function confirmar() {
    iniciar(async () => {
      const r = await montarMontagem(montagemId);
      if (r.erro) return setErro(r.erro);
      if (r.faltando) {
        setPecas((atuais) =>
          atuais.map((p) => r.faltando!.find((x) => x.itemId === p.itemId) ?? p),
        );
        return setErro("O saldo mudou enquanto a janela estava aberta.");
      }
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Botao variante="movimento" tamanho="sm" onClick={abrir}>
        <Hammer className="size-4" />
        Montar
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Montar"
        descricao={`Sai do estoque o que está listado, e entra uma unidade de ${item}.`}
        icone={<Hammer className="size-5 text-alerta" />}
        rodape={
          <>
            <Botao variante="suave" onClick={() => setAberto(false)} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao
              variante="movimento"
              onClick={confirmar}
              disabled={pendente || carregando || !podeMontar}
            >
              {pendente ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {pendente ? "Montando..." : "Confirmar montagem"}
            </Botao>
          </>
        }
      >
        {carregando ? (
          <p className="py-8 text-center text-sm text-texto-fraco">Conferindo o estoque...</p>
        ) : (
          <div className="space-y-4">
            {erro && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2.5 text-sm font-medium text-perigo"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {erro}
              </p>
            )}

            {pecas.length === 0 ? (
              <p className="rounded-lg bg-superficie-2 px-3 py-2.5 text-sm text-texto-fraco">
                Esta montagem não tem nenhuma peça dentro — não há o que consumir.
              </p>
            ) : (
              <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
                {pecas.map((p) => {
                  const falta = p.disponivel < p.necessario;
                  return (
                    <li key={p.itemId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                      <span className="num shrink-0 text-xs font-semibold text-texto-suave">
                        {numero(p.necessario)} {p.unidade}
                      </span>
                      <Selo tom={falta ? "perigo" : "ok"}>
                        {falta ? `tem ${numero(p.disponivel)}` : "em estoque"}
                      </Selo>
                    </li>
                  );
                })}
              </ul>
            )}

            {faltando.length > 0 && (
              <p className="rounded-lg bg-alerta-suave px-3 py-2.5 text-sm font-medium text-alerta">
                {faltando.length === 1 ? "Falta 1 peça" : `Faltam ${faltando.length} peças`}.
                Compre ou monte o que está faltando antes de montar esta unidade.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
