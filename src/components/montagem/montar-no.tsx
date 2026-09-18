"use client";

import { AlertTriangle, Check, Hammer, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { Selo } from "@/components/ui/selo";
import { conferirNo, montarNo, type FaltaNaMontagem } from "@/lib/acoes/montagem";
import { numero } from "@/lib/utils";

/**
 * Fechar uma etapa da montagem.
 *
 * A janela existe porque montar nao e mudar um campo: peca sai do estoque e
 * o no congela. Antes de confirmar, quem esta na bancada ve exatamente o que
 * vai ser consumido e o que esta faltando — foi o pedido de quem nao quer
 * descobrir na hora que faltou parafuso.
 */
export function MontarNo({
  montagemId,
  noId,
  rotulo,
  variante = "contorno",
}: {
  montagemId: string;
  /** Nulo fecha o equipamento inteiro. */
  noId: string | null;
  rotulo: string;
  variante?: "contorno" | "movimento";
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [filhos, setFilhos] = useState<FaltaNaMontagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setAberto(true);
    setErro(null);
    setCarregando(true);
    const r = await conferirNo(montagemId, noId);
    setFilhos(r.filhos ?? []);
    setErro(r.erro ?? null);
    setCarregando(false);
  }

  const faltando = filhos.filter((f) => f.disponivel < f.necessario);
  const podeMontar = faltando.length === 0;

  function confirmar() {
    iniciar(async () => {
      const r = await montarNo(montagemId, noId);
      if (r.erro) return setErro(r.erro);
      if (r.faltando) {
        setFilhos((atuais) =>
          atuais.map((f) => r.faltando!.find((x) => x.nome === f.nome) ?? f),
        );
        return setErro("O saldo mudou enquanto a janela estava aberta.");
      }
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Botao variante={variante} tamanho="sm" onClick={abrir}>
        <Hammer className="size-4" />
        {rotulo}
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={noId ? "Montar divisão" : "Concluir equipamento"}
        descricao={
          noId
            ? "Sai do estoque o que está listado, e a divisão congela."
            : "Fecha o equipamento. Depois disso ele pode ir para um carro."
        }
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

            {filhos.length === 0 ? (
              <p className="rounded-lg bg-superficie-2 px-3 py-2.5 text-sm text-texto-fraco">
                Esta divisão está vazia: nada sai do estoque. Confirmar só marca a etapa como
                feita, com a data de hoje.
              </p>
            ) : (
              <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
                {filhos.map((f) => {
                  const falta = f.disponivel < f.necessario;
                  return (
                    <li key={f.nome} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">{f.nome}</span>

                      {f.tipo === "divisao" ? (
                        <Selo tom={falta ? "perigo" : "ok"}>
                          {falta ? "ainda não montada" : "montada"}
                        </Selo>
                      ) : (
                        <>
                          <span className="num shrink-0 text-xs font-semibold text-texto-suave">
                            {numero(f.necessario)} {f.unidade}
                          </span>
                          <Selo tom={falta ? "perigo" : "ok"}>
                            {falta ? `tem ${numero(f.disponivel)}` : "em estoque"}
                          </Selo>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {faltando.length > 0 && (
              <p className="rounded-lg bg-alerta-suave px-3 py-2.5 text-sm font-medium text-alerta">
                Falta {faltando.length} {faltando.length === 1 ? "item" : "itens"}. Compre ou
                monte o que está faltando antes de fechar esta etapa.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
